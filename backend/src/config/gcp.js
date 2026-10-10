import { Storage } from "@google-cloud/storage";
import { memoryStorage } from "./memoryStorage.js";

export const PROJECT_ID = process.env.GCP_PROJECT_ID;
export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "memory";
export const GCP_MUTATIONS_ENABLED = process.env.GCP_ALLOW_MUTATIONS === "true";
export const BUCKET_ALLOWLIST = (process.env.GCP_BUCKET_ALLOWLIST || "").split(",").map((name) => name.trim()).filter(Boolean);
const configuredObjectLimit = Number.parseInt(process.env.GCP_MAX_OBJECT_ACLS || "100", 10);
export const MAX_OBJECT_ACLS = configuredObjectLimit === 0 ? Infinity : Math.max(1, Number.isFinite(configuredObjectLimit) ? configuredObjectLimit : 100);

if (!["memory", "gcp"].includes(STORAGE_PROVIDER)) {
  throw new Error("STORAGE_PROVIDER must be either 'memory' or 'gcp'");
}

if (STORAGE_PROVIDER === "gcp" && BUCKET_ALLOWLIST.length === 0) {
  throw new Error("Set GCP_BUCKET_ALLOWLIST to the specific team buckets before using the GCP provider");
}

export function isBucketAllowed(bucketName) {
  return STORAGE_PROVIDER !== "gcp" || BUCKET_ALLOWLIST.includes(bucketName);
}

export function assertBucketAllowed(bucketName) {
  if (!isBucketAllowed(bucketName)) throw Object.assign(new Error("Bucket is outside GCP_BUCKET_ALLOWLIST"), { code: 403 });
}

export const storage = STORAGE_PROVIDER === "gcp"
  ? new Storage({ projectId: PROJECT_ID })
  : memoryStorage;
