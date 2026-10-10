import { appendFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { auditBucketAclsAll } from "./auditService.js";
import { getBucketIamPolicy } from "./iamService.js";
import { assertBucketAllowed } from "../config/gcp.js";

const PLAN_FILE = fileURLToPath(new URL("../../data/migrations.jsonl", import.meta.url));

async function allPlans() {
  try {
    const contents = await readFile(PLAN_FILE, "utf8");
    const versions = contents.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return [...new Map(versions.map((plan) => [plan.planId, plan])).values()];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function save(plan) {
  await appendFile(PLAN_FILE, `${JSON.stringify(plan)}\n`);
  return plan;
}

export async function listPlans() {
  return allPlans();
}

export async function getPlan(planId) {
  return (await allPlans()).find((plan) => plan.planId === planId) || null;
}

export async function createPlan(bucketName, actor) {
  assertBucketAllowed(bucketName);
  const [inventory, iamPolicy] = await Promise.all([auditBucketAclsAll(bucketName), getBucketIamPolicy(bucketName)]);
  const grouped = new Map();
  const actions = inventory.findings.map((finding) => {
    const recommendation = finding.recommendation;
    if (recommendation.action === "MIGRATE_TO_IAM" && recommendation.suggestedRole && recommendation.suggestedMember) {
      const key = `${recommendation.suggestedMember}|${recommendation.suggestedRole}`;
      const action = grouped.get(key) || {
        actionType: "ADD_IAM_BINDING",
        sourceFindings: [],
        member: recommendation.suggestedMember,
        role: recommendation.suggestedRole,
        justification: "Replace legacy ACL access with an IAM binding",
      };
      action.sourceFindings.push(finding.id);
      grouped.set(key, action);
      return null;
    }
    if (recommendation.action === "MIGRATE_TO_IAM") return {
      actionType: "MANUAL_REVIEW",
      sourceFindings: [finding.id],
      object: finding.object,
      entity: finding.entity,
      permission: finding.permission,
      scope: finding.scope,
      justification: "No safe IAM role mapping is available for this ACL grant",
    };
    if (recommendation.action === "REMOVE_ACL") return {
      actionType: "REMOVE_ACL",
      sourceFindings: [finding.id],
      object: finding.object,
      entity: finding.entity,
      permission: finding.permission,
      scope: finding.scope,
      justification: "Equivalent IAM membership was detected; review before removing this ACL",
    };
    if (recommendation.action === "REMOVE_OR_ISOLATE") return {
      actionType: "REMOVE_ACL",
      sourceFindings: [finding.id],
      object: finding.object,
      entity: finding.entity,
      permission: finding.permission,
      scope: finding.scope,
      justification: "Public access requires explicit security review",
    };
    return { actionType: "MANUAL_REVIEW", sourceFindings: [finding.id], justification: "Unsupported ACL finding requires manual review" };
  }).filter(Boolean);
  actions.unshift(...grouped.values());
  const now = new Date().toISOString();
  return save({
    planId: `plan_${randomUUID()}`,
    bucketName,
    status: "PENDING_APPROVAL",
    actions,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    aclFindingCount: inventory.totalFindings,
    inventoryComplete: !inventory.objectAclInventoryTruncated,
    iamPolicyEtag: iamPolicy.etag || null,
    findings: inventory.findings,
  });
}

export async function removeAclAction(bucketName, action) {
  const bucket = (await import("../config/gcp.js")).storage.bucket(bucketName);
  const collection = action.scope === "BUCKET_ACL"
    ? bucket.acl
    : action.scope === "DEFAULT_OBJECT_ACL"
      ? bucket.acl.default
      : bucket.file(action.object).acl;
  const [before] = await collection.get();
  const current = before.find((acl) => acl.entity === action.entity);
  if (!current || current.role !== action.permission) {
    throw Object.assign(new Error(`ACL changed since planning for ${action.entity}`), { code: 409 });
  }
  await collection.delete({ entity: action.entity });
  return { before: current };
}

export async function restoreAclAction(bucketName, action) {
  const bucket = (await import("../config/gcp.js")).storage.bucket(bucketName);
  const collection = action.scope === "BUCKET_ACL"
    ? bucket.acl
    : action.scope === "DEFAULT_OBJECT_ACL"
      ? bucket.acl.default
      : bucket.file(action.object).acl;
  await collection.add({ entity: action.entity, role: action.permission });
}

export async function changePlanStatus(plan, status, actor) {
  return save({ ...plan, status, updatedAt: new Date().toISOString(), updatedBy: actor });
}
