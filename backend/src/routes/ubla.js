import { Router } from "express";
import { enableUniformBucketLevelAccess, getBucketDetails } from "../services/storageService.js";
import { auditBucketAclsAll } from "../services/auditService.js";
import { requireAdmin, requireCloudMutationEnabled } from "../middleware/auth.js";
import { logChange } from "../middleware/audit.js";
import { getBucketIamPolicy } from "../services/iamService.js";
import { getAclDependency } from "../services/aclDependencyService.js";

const router = Router();
const CONFIRMATION = "ENABLE UBLA";

router.get("/:bucketName/preflight", async (req, res) => {
  const bucket = req.params.bucketName;
  const [details, audit, policy, aclDependency] = await Promise.all([
    getBucketDetails(bucket), auditBucketAclsAll(bucket), getBucketIamPolicy(bucket), getAclDependency(bucket),
  ]);
  const conditions = policy.bindings.filter((binding) => binding.condition).length;
  const checks = [
    { name: "no-blocking-acl-findings", passed: audit.blockingFindings === 0, detail: `${audit.blockingFindings} blocking ACL findings` },
    { name: "acl-inventory-complete", passed: !audit.objectAclInventoryTruncated, detail: audit.objectAclInventoryTruncated ? `Object ACL scan reached the configured ${audit.objectsScanned}-object limit; raise GCP_MAX_OBJECT_ACLS and rescan before enabling UBLA` : `Object ACL scan completed for ${audit.objectsScanned} objects` },
    { name: "uniform-access-disabled", passed: !details.uniformBucketLevelAccess, detail: details.uniformBucketLevelAccess ? "UBLA is already enabled" : "UBLA is currently disabled" },
    { name: "iam-conditions-reviewed", passed: conditions === 0, detail: `${conditions} conditional IAM bindings; review rollback compatibility` },
    { name: "acl-usage-metric", passed: ["ZERO", "SIMULATED_ZERO"].includes(aclDependency.status), status: aclDependency.status, detail: aclDependency.reason || aclDependency.interpretation || `ACL dependency count: ${aclDependency.count}` },
  ];
  res.json({ bucket, ready: checks.every((check) => check.passed), checks, aclDependency, confirmationText: CONFIRMATION });
});

router.get("/:bucketName/status", async (req, res) =>
  res.json(await getBucketDetails(req.params.bucketName))
);

router.post("/:bucketName/enable", requireAdmin, requireCloudMutationEnabled, async (req, res) => {
  const bucket = req.params.bucketName;

  if (req.body?.confirmation !== CONFIRMATION) {
    return res.status(400).json({ error: `Send confirmation: ${CONFIRMATION}` });
  }

  const preflight = await (async () => {
    const [details, inventory, policy, aclDependency] = await Promise.all([
      getBucketDetails(bucket), auditBucketAclsAll(bucket), getBucketIamPolicy(bucket), getAclDependency(bucket),
    ]);
    const checks = {
      aclFindings: inventory.blockingFindings === 0,
      inventoryComplete: !inventory.objectAclInventoryTruncated,
      notAlreadyEnabled: !details.uniformBucketLevelAccess,
      noConditionalBindings: !policy.bindings.some((binding) => binding.condition),
      aclMetricClear: ["ZERO", "SIMULATED_ZERO"].includes(aclDependency.status),
    };
    return { checks, aclDependency, ready: Object.values(checks).every(Boolean) };
  })();
  if (!preflight.ready) return res.status(409).json({ error: "UBLA preflight is not ready", preflight });

  const before = await getBucketDetails(bucket);
  const after = await enableUniformBucketLevelAccess(bucket);
  await logChange(req, { action: "ENABLE_UBLA", bucket, before, after });

  res.json({
    message: "Uniform bucket-level access enabled",
    bucket: after,
    rollbackDeadline: after.ublaLockedTime,
  });
});

export default router;
