import { BUCKET_ALLOWLIST, STORAGE_PROVIDER, assertBucketAllowed, storage } from "../config/gcp.js";

function summarize(m) {
  const iam = m.iamConfiguration || {};
  return {
    name: m.name,
    team: m.labels?.team || "UNASSIGNED",
    location: m.location,
    storageClass: m.storageClass,
    created: m.timeCreated,
    uniformBucketLevelAccess: iam.uniformBucketLevelAccess?.enabled === true,
    // Last moment UBLA can be turned off again; after this it is permanent.
    ublaLockedTime: iam.uniformBucketLevelAccess?.lockedTime || null,
    publicAccessPrevention: iam.publicAccessPrevention || "inherited",
    versioning: m.versioning?.enabled === true,
  };
}

export async function listBuckets() {
  if (STORAGE_PROVIDER === "gcp") {
    const buckets = await Promise.all(BUCKET_ALLOWLIST.map(async (name) => {
      const [metadata] = await storage.bucket(name).getMetadata();
      return summarize(metadata);
    }));
    return buckets;
  }
  const [buckets] = await storage.getBuckets();
  return buckets.map((b) => summarize(b.metadata));
}

export async function getBucketDetails(bucketName) {
  assertBucketAllowed(bucketName);
  const [metadata] = await storage.bucket(bucketName).getMetadata();
  return summarize(metadata);
}

export async function listObjects(bucketName, limit = 100) {
  assertBucketAllowed(bucketName);
  const [files] = await storage.bucket(bucketName).getFiles({
    maxResults: limit,
    autoPaginate: false,
  });
  return files.map((f) => ({
    name: f.name,
    size: Number(f.metadata.size || 0),
    updated: f.metadata.updated,
    storageClass: f.metadata.storageClass,
  }));
}

export async function enableUniformBucketLevelAccess(bucketName) {
  assertBucketAllowed(bucketName);
  await storage.bucket(bucketName).setMetadata({
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
  });
  return getBucketDetails(bucketName);
}
