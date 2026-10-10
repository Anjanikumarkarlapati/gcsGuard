import { appendFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditBucketAclsAll } from "./auditService.js";
import { listBuckets } from "./storageService.js";

const FINDING_FILE = fileURLToPath(new URL("../../data/finding-status.jsonl", import.meta.url));

async function statuses() {
  try {
    const lines = (await readFile(FINDING_FILE, "utf8")).split("\n").filter(Boolean);
    return new Map(lines.map((line) => JSON.parse(line)).map((item) => [item.findingId, item]));
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

export async function listFindings() {
  const buckets = await listBuckets();
  const inventories = await Promise.all(buckets.map((bucket) => auditBucketAclsAll(bucket.name)));
  const state = await statuses();
  const current = inventories.flatMap((inventory) => inventory.findings.map((finding) => ({
    ...finding,
    status: state.get(finding.id)?.status || "OPEN",
    owner: state.get(finding.id)?.owner || null,
    note: state.get(finding.id)?.note || null,
  })));
  const currentIds = new Set(current.map((finding) => finding.id));
  const historical = [...state.values()].filter((item) => !currentIds.has(item.findingId)).map((item) => ({
    ...item,
    id: item.findingId,
    historical: true,
    bucket: item.bucket || item.bucketName,
  }));
  return [...current, ...historical];
}

export async function updateFinding(findingId, update, actor) {
  const allowed = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK"]);
  if (!allowed.has(update.status)) throw Object.assign(new Error("status must be OPEN, IN_PROGRESS, RESOLVED, or ACCEPTED_RISK"), { code: 400 });
  const records = await listFindings();
  const state = await statuses();
  const current = records.find((finding) => finding.id === findingId);
  if (!current && !state.has(findingId)) return null;
  return setFindingStatus(findingId, update.status, actor, { ...state.get(findingId), ...current, ...update });
}

export async function setFindingStatus(findingId, status, actor, extra = {}) {
  const record = { ...extra, findingId, status, owner: extra.owner || null, note: extra.note || null, actor, updatedAt: new Date().toISOString() };
  await appendFile(FINDING_FILE, `${JSON.stringify(record)}\n`);
  return record;
}

export async function complianceSummary() {
  const buckets = await listBuckets();
  const findings = await listFindings();
  const open = findings.filter((item) => !["RESOLVED", "ACCEPTED_RISK"].includes(item.status));
  return {
    generatedAt: new Date().toISOString(),
    bucketCount: buckets.length,
    ublaEnabledCount: buckets.filter((bucket) => bucket.uniformBucketLevelAccess).length,
    publicAclFindingCount: findings.filter((item) => !item.historical && ["allUsers", "allAuthenticatedUsers"].includes(item.entity)).length,
    openFindingCount: open.length,
    acceptedRiskCount: findings.filter((item) => item.status === "ACCEPTED_RISK").length,
    highRiskBucketCount: buckets.filter((bucket) => !bucket.uniformBucketLevelAccess).length,
  };
}
