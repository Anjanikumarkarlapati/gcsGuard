import { GoogleAuth, Impersonated } from "google-auth-library";
import { storage, STORAGE_PROVIDER } from "../config/gcp.js";

export async function getBucketIamPolicy(bucketName) {
  const [policy] = await storage
    .bucket(bucketName)
    .iam.getPolicy({ requestedPolicyVersion: 3 });
  policy.bindings ||= [];
  return policy;
}

// Conditional bindings are left untouched: only the unconditional binding for
// a role is edited, so we never widen or drop someone's conditional access.
const plain = (role) => (b) => b.role === role && !b.condition;

export async function addBucketIamBinding(bucketName, member, role) {
  const before = await getBucketIamPolicy(bucketName);
  const policy = structuredClone(before);

  const existing = policy.bindings.find(plain(role));
  if (existing) {
    if (!existing.members.includes(member)) existing.members.push(member);
  } else {
    policy.bindings.push({ role, members: [member] });
  }

  const [after] = await storage.bucket(bucketName).iam.setPolicy(policy);
  return { before, after };
}

export async function removeBucketIamBinding(bucketName, member, role) {
  const before = await getBucketIamPolicy(bucketName);
  const policy = structuredClone(before);
  const isTarget = plain(role);

  policy.bindings = policy.bindings
    .map((b) =>
      isTarget(b) ? { ...b, members: b.members.filter((m) => m !== member) } : b
    )
    .filter((b) => b.members.length > 0);

  const [after] = await storage.bucket(bucketName).iam.setPolicy(policy);
  return { before, after };
}

export async function testBucketPermissions(bucketName, permissions) {
  const [result] = await storage.bucket(bucketName).iam.testPermissions(permissions);
  return result;
}

// Reads the first KB of an object as another service account, to prove who
// can and cannot download after migration. Backend SA needs
// roles/iam.serviceAccountTokenCreator on the target.
export async function downloadAs(bucketName, objectName, targetPrincipal) {
  if (STORAGE_PROVIDER !== "gcp") {
    return { status: 501, error: "Principal impersonation tests require STORAGE_PROVIDER=gcp and configured service-account credentials" };
  }
  const sourceClient = await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient();
  const client = new Impersonated({
    sourceClient,
    targetPrincipal,
    targetScopes: ["https://www.googleapis.com/auth/devstorage.read_only"],
    lifetime: 300,
  });

  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}` +
    `/o/${encodeURIComponent(objectName)}?alt=media`;

  try {
    const res = await client.request({
      url,
      headers: { Range: "bytes=0-1023" },
      responseType: "arraybuffer",
    });
    return { status: res.status, bytesRead: res.data.byteLength };
  } catch (err) {
    return { status: err.response?.status ?? 500, error: err.message };
  }
}
