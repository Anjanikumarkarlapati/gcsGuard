import { Router } from "express";
import { listBuckets, getBucketDetails, listObjects } from "../services/storageService.js";
import { getBucketIamPolicy } from "../services/iamService.js";
import { auditBucketAcls, auditBucketAclsAll, getRiskSummary } from "../services/auditService.js";
import { readLog } from "../middleware/audit.js";

const router = Router();

router.get("/", async (_req, res) => res.json(await listBuckets()));

router.get("/:bucketName", async (req, res) =>
  res.json(await getBucketDetails(req.params.bucketName))
);

router.get("/:bucketName/objects", async (req, res) =>
  res.json(await listObjects(req.params.bucketName))
);

router.get("/:bucketName/acl-inventory", async (req, res) =>
  res.json(await auditBucketAcls(req.params.bucketName, req.query.pageToken ? { pageToken: String(req.query.pageToken) } : {}))
);

router.get("/:bucketName/risk-summary", async (req, res) =>
  res.json(await getRiskSummary(req.params.bucketName))
);

// Everything a reviewer needs as migration evidence, in one download.
router.get("/:bucketName/report", async (req, res) => {
  const name = req.params.bucketName;
  const [bucket, aclAudit, iamPolicy, tests, changes] = await Promise.all([
    getBucketDetails(name),
    auditBucketAclsAll(name),
    getBucketIamPolicy(name),
    readLog("tests", name),
    readLog("audit", name),
  ]);
  res.json({
    generatedAt: new Date().toISOString(),
    generatedBy: req.user.email,
    bucket,
    ublaLockDate: bucket.ublaLockedTime,
    aclInventory: aclAudit,
    iamMatrix: iamPolicy.bindings,
    testEvidence: tests,
    changeLog: changes,
  });
});

export default router;
