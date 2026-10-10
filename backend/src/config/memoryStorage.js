import { demoBuckets, rollbackDeadline } from "./demoBuckets.js";

function aclCollection(read, write, isDisabled = () => false) {
  return {
    async get() {
      if (isDisabled()) throw Object.assign(new Error("ACL operations are disabled when uniform bucket-level access is enabled"), { code: 400 });
      return [structuredClone(read())];
    },
    async add(entries) { if (isDisabled()) throw Object.assign(new Error("ACL operations are disabled when uniform bucket-level access is enabled"), { code: 400 }); write([...read(), ...(Array.isArray(entries) ? entries : [entries])]); },
    async delete({ entity }) { if (isDisabled()) throw Object.assign(new Error("ACL operations are disabled when uniform bucket-level access is enabled"), { code: 400 }); write(read().filter((entry) => entry.entity !== entity)); },
  };
}

function memoryBucket(record) {
  const bucket = {
    metadata: record.metadata,
    acl: aclCollection(() => record.bucketAcl, (value) => { record.bucketAcl = value; }, () => record.metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true),
    getFiles: async ({ maxResults = 100, autoPaginate = true, pageToken } = {}) => {
      const offset = Number.parseInt(pageToken || "0", 10) || 0;
      const selected = autoPaginate ? record.objects : record.objects.slice(offset, offset + maxResults);
      const files = selected.map((object) => ({
        name: object.name,
        metadata: { size: object.size, updated: object.updated, storageClass: object.storageClass },
        acl: aclCollection(() => object.acls, (value) => { object.acls = value; }, () => record.metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true),
      }));
      return [files, !autoPaginate && offset + files.length < record.objects.length ? { pageToken: String(offset + files.length) } : null];
    },
    file(name) {
      const object = record.objects.find((item) => item.name === name);
      if (!object) throw Object.assign(new Error(`Object ${name} was not found`), { code: 404 });
      return { name, acl: aclCollection(() => object.acls, (value) => { object.acls = value; }, () => record.metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true) };
    },
    getMetadata: async () => [structuredClone(record.metadata)],
    setMetadata: async (patch) => {
      const wasEnabled = record.metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true;
      record.metadata = { ...record.metadata, ...patch, iamConfiguration: { ...record.metadata.iamConfiguration, ...patch.iamConfiguration, uniformBucketLevelAccess: { ...record.metadata.iamConfiguration?.uniformBucketLevelAccess, ...patch.iamConfiguration?.uniformBucketLevelAccess } } };
      const ubla = record.metadata.iamConfiguration.uniformBucketLevelAccess;
      if (ubla.enabled && !wasEnabled) ubla.lockedTime = rollbackDeadline();
      return [structuredClone(record.metadata)];
    },
  };
  bucket.acl.default = aclCollection(() => record.defaultAcl, (value) => { record.defaultAcl = value; }, () => record.metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true);
  bucket.iam = {
    getPolicy: async () => [structuredClone(record.policy)],
    setPolicy: async (policy) => { record.policy = { ...structuredClone(policy), etag: `memory-${Date.now()}` }; return [structuredClone(record.policy)]; },
    testPermissions: async (permissions) => [permissions.filter((permission) =>
      permission === "storage.buckets.get" || record.policy.bindings.some((binding) => binding.role === "roles/storage.admin")
    )],
  };
  return bucket;
}

export const memoryStorage = {
  async getBuckets() { return [demoBuckets.map((record) => ({ metadata: structuredClone(record.metadata) }))]; },
  bucket(name) {
    const record = demoBuckets.find((item) => item.metadata.name === name);
    if (!record) throw Object.assign(new Error(`Bucket ${name} was not found`), { code: 404 });
    return memoryBucket(record);
  },
};
