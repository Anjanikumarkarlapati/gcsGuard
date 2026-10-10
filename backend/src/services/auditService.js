import { MAX_OBJECT_ACLS, storage } from "../config/gcp.js";
import { getBucketIamPolicy } from "./iamService.js";

const BUCKET_ROLE = {
  READER: "roles/storage.legacyBucketReader",
  WRITER: "roles/storage.legacyBucketWriter",
  OWNER: "roles/storage.legacyBucketOwner",
};

const OBJECT_ROLE = {
  READER: "roles/storage.legacyObjectReader",
  OWNER: "roles/storage.legacyObjectOwner",
};

const PROJECT_MEMBER = { owners: "projectOwner", editors: "projectEditor", viewers: "projectViewer" };

// ACL entity ("user-a@x.com", "group-g@x.com", "domain-x.com", "allUsers",
// "project-viewers-123") -> IAM member ("user:a@x.com", ...).
export function entityToMember(entity) {
  if (entity === "allUsers" || entity === "allAuthenticatedUsers") return entity;
  const project = entity.match(/^project-(owners|editors|viewers)-(.+)$/);
  if (project) return `${PROJECT_MEMBER[project[1]]}:${project[2]}`;
  const principal = entity.match(/^(user|group|domain)-(.+)$/);
  if (principal) return `${principal[1]}:${principal[2]}`;
  return entity;
}

export function buildRecommendation(acl, scope, iamMembers) {
  const member = entityToMember(acl.entity);

  if (member === "allUsers" || member === "allAuthenticatedUsers") {
    return { action: "REMOVE_OR_ISOLATE", reason: "Public ACL grant detected", suggestedRole: null };
  }

  const roles = scope === "BUCKET_ACL" ? BUCKET_ROLE : OBJECT_ROLE;
  const equivalentRole = roles[acl.role];
  const covered = equivalentRole && iamMembers.has(`${equivalentRole}|${member}`);

  // Only treat the ACL as redundant when the same principal has the exact
  // legacy IAM role that mirrors this ACL permission.
  if (covered) {
    return { action: "REMOVE_ACL", reason: "Equivalent IAM access already exists", suggestedRole: null };
  }

  return {
    action: "MIGRATE_TO_IAM",
    reason: "ACL-only access detected",
    suggestedRole: roles[acl.role] || null,
    suggestedMember: member,
  };
}

export const isBlocking = (f) => f.recommendation.action !== "REMOVE_ACL";

export async function auditBucketAcls(bucketName, { pageToken, maxResults = 100 } = {}) {
  const bucket = storage.bucket(bucketName);
  const [metadata] = await bucket.getMetadata();
  const ublaEnabled = metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true;

  // ACL endpoints return 400 once UBLA is on, and ACLs no longer grant access.
  if (ublaEnabled) {
    return { bucket: bucketName, ublaEnabled, totalFindings: 0, blockingFindings: 0, findings: [], objectAclInventoryTruncated: false };
  }

  const policy = await getBucketIamPolicy(bucketName);
  const iamMembers = new Set(policy.bindings
    .filter((binding) => !binding.condition)
    .flatMap((binding) => binding.members.map((member) => `${binding.role}|${member}`)));

  const [[bucketAcls], [defaultAcls], [files, nextQuery]] = await Promise.all([
    pageToken ? Promise.resolve([[]]) : bucket.acl.get(),
    pageToken ? Promise.resolve([[]]) : bucket.acl.default.get(),
    bucket.getFiles({ autoPaginate: false, maxResults, ...(pageToken ? { pageToken } : {}) }),
  ]);

  const findings = [
    ...bucketAcls.map((acl) => ["BUCKET_ACL", acl]),
    ...defaultAcls.map((acl) => ["DEFAULT_OBJECT_ACL", acl]),
    ...(await Promise.all(files.map(async (file) => {
      const [objectAcls] = await file.acl.get();
      return objectAcls.map((acl) => ["OBJECT_ACL", { ...acl, object: file.name }]);
    }))).flat(),
  ].map(([scope, acl]) => ({
    id: `${scope.toLowerCase()}_${Buffer.from(`${acl.object || "bucket"}:${acl.entity}:${acl.role}`).toString("base64url")}`,
    bucket: bucketName,
    scope,
    object: acl.object || null,
    entity: acl.entity,
    email: acl.email || null,
    permission: acl.role,
    recommendation: buildRecommendation(acl, scope, iamMembers),
  }));

  return {
    bucket: bucketName,
    ublaEnabled,
    totalFindings: findings.length,
    blockingFindings: findings.filter(isBlocking).length,
    findings,
    objectAclInventoryTruncated: Boolean(nextQuery?.pageToken),
    nextPageToken: nextQuery?.pageToken || null,
    objectsScanned: files.length,
  };
}

export async function auditBucketAclsAll(bucketName) {
  const pages = [];
  let pageToken;
  let objectsScanned = 0;
  do {
    const remaining = MAX_OBJECT_ACLS - objectsScanned;
    if (remaining <= 0) break;
    const page = await auditBucketAcls(bucketName, { ...(pageToken ? { pageToken } : {}), maxResults: Math.min(100, remaining) });
    pages.push(page);
    objectsScanned += page.objectsScanned || 0;
    pageToken = page.nextPageToken;
  } while (pageToken && objectsScanned < MAX_OBJECT_ACLS);
  const findings = pages.flatMap((page) => page.findings);
  return {
    bucket: bucketName,
    ublaEnabled: pages[0]?.ublaEnabled ?? false,
    totalFindings: findings.length,
    blockingFindings: findings.filter(isBlocking).length,
    findings,
    objectAclInventoryTruncated: Boolean(pageToken),
    nextPageToken: pageToken || null,
    objectsScanned,
  };
}

export async function getRiskSummary(bucketName) {
  const [bucket, policy, inventory] = await Promise.all([
    storage.bucket(bucketName).getMetadata(),
    getBucketIamPolicy(bucketName),
    auditBucketAclsAll(bucketName),
  ]);
  const metadata = bucket[0];
  const publicFindings = inventory.findings.filter((f) => ["allUsers", "allAuthenticatedUsers"].includes(f.entity)).length;
  const aclOnlyPrincipals = new Set(inventory.findings
    .filter((f) => f.recommendation.action === "MIGRATE_TO_IAM")
    .map((f) => f.recommendation.suggestedMember)).size;
  const riskScore = Math.min(100, publicFindings * 40 + aclOnlyPrincipals * 10 + inventory.blockingFindings * 5);
  return {
    bucketName,
    ublaEnabled: metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true,
    publicAclFindings: publicFindings,
    aclOnlyPrincipals,
    iamBindings: policy.bindings.length,
    riskScore,
    riskLevel: riskScore >= 70 ? "HIGH" : riskScore >= 35 ? "MEDIUM" : "LOW",
    recommendedAction: inventory.blockingFindings ? "MIGRATE_ACLS_TO_IAM" : "ENABLE_UBLA",
  };
}

// Tries a bucket ACL read; after UBLA this should come back 400.
export async function probeAclApi(bucketName) {
  try {
    await storage.bucket(bucketName).acl.get();
    return { status: 200, message: "ACL API reachable (UBLA not enforced)" };
  } catch (err) {
    return { status: err.code ?? 500, message: err.message };
  }
}
