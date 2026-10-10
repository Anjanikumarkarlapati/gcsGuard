import { Router } from "express";
import { readLog, logChange } from "../middleware/audit.js";
import { requireAdmin } from "../middleware/auth.js";
import { complianceSummary, listFindings, updateFinding } from "../services/governanceService.js";
import { getBucketIamPolicy } from "../services/iamService.js";
import { getBucketDetails } from "../services/storageService.js";
import { auditBucketAclsAll } from "../services/auditService.js";
import { createPdf } from "../services/pdfService.js";

const router = Router();

router.get("/audit-logs", async (req, res) => {
  const logs = await readLog("audit");
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 1000);
  res.json(logs.slice(0, limit));
});

router.get("/findings", async (_req, res) => res.json(await listFindings()));

router.patch("/findings/:findingId", requireAdmin, async (req, res) => {
  const { status, owner, note } = req.body || {};
  if (typeof status !== "string") return res.status(400).json({ error: "status is required" });
  const finding = await updateFinding(req.params.findingId, { status, owner, note }, req.user.email);
  if (!finding) return res.status(404).json({ error: "Finding not found" });
  await logChange(req, { action: "FINDING_STATUS_UPDATED", findingId: req.params.findingId, status, owner, note });
  res.json(finding);
});

router.get("/compliance", async (_req, res) => res.json(await complianceSummary()));

router.get("/buckets/:bucketName/reports/iam-matrix", async (req, res) => {
  const [bucket, policy] = await Promise.all([getBucketDetails(req.params.bucketName), getBucketIamPolicy(req.params.bucketName)]);
  const rows = policy.bindings.flatMap((binding) => binding.members.map((principal) => ({ principal, bucket: bucket.name, role: binding.role, condition: binding.condition?.title || "" })));
  if (req.query.format === "csv") {
    res.type("text/csv").send(["principal,bucket,role,condition", ...rows.map((row) => [row.principal, row.bucket, row.role, row.condition].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\r\n"));
  } else res.json(rows);
});

router.get("/buckets/:bucketName/reports/migration", async (req, res) => {
  const bucketName = req.params.bucketName;
  const [bucket, inventory, policy, tests, changes] = await Promise.all([
    getBucketDetails(bucketName), auditBucketAclsAll(bucketName), getBucketIamPolicy(bucketName),
    readLog("tests", bucketName), readLog("audit", bucketName),
  ]);
  const report = { generatedAt: new Date().toISOString(), bucket, aclInventory: inventory, iamMatrix: policy.bindings, testEvidence: tests, changeLog: changes };
  if (req.query.format === "pdf") {
    const lines = [
      `GCS Guard migration report: ${bucketName}`,
      `Generated: ${report.generatedAt}`,
      `Team: ${bucket.team} | UBLA: ${bucket.uniformBucketLevelAccess ? "enabled" : "disabled"}`,
      `ACL findings: ${inventory.totalFindings} | blocking: ${inventory.blockingFindings}`,
      `IAM bindings: ${policy.bindings.length} | tests: ${tests.length} | audited changes: ${changes.length}`,
      "",
      ...inventory.findings.map((finding) => `${finding.scope} | ${finding.entity} | ${finding.permission} | ${finding.recommendation.action}`),
    ];
    res.type("application/pdf").attachment(`${bucketName}-migration-report.pdf`).send(createPdf(lines));
  } else if (req.query.format === "csv") {
    const rows = inventory.findings.map((finding) => ({ findingId: finding.id, scope: finding.scope, object: finding.object || "", entity: finding.entity, permission: finding.permission, recommendation: finding.recommendation.action }));
    res.type("text/csv").send(["findingId,scope,object,entity,permission,recommendation", ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\r\n"));
  } else res.json(report);
});

export default router;
