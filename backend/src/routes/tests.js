import { Router } from "express";
import { probeAclApi } from "../services/auditService.js";
import { downloadAs } from "../services/iamService.js";
import { requireAdmin } from "../middleware/auth.js";
import { readLog, recordTest } from "../middleware/audit.js";

const router = Router();

router.get("/:bucketName", async (req, res) =>
  res.json(await readLog("tests", req.params.bucketName))
);

// Demo step 6: after UBLA, ACL calls should fail with 400.
router.post("/:bucketName/acl-probe", async (req, res) => {
  const bucket = req.params.bucketName;
  const result = await probeAclApi(bucket);
  res.json(await recordTest(req, { type: "ACL_PROBE", bucket, expected: 400, result }));
});

// Demo steps 7-8: download as an authorised (expect 206) and unauthorised (expect 403) principal.
router.post("/:bucketName/download", requireAdmin, async (req, res) => {
  const { object, principal, expected } = req.body ?? {};
  if (!object || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(principal ?? "")) {
    return res.status(400).json({ error: "object and a service-account principal are required" });
  }
  const bucket = req.params.bucketName;
  const result = await downloadAs(bucket, object, principal);
  res.json(
    await recordTest(req, { type: "DOWNLOAD_AS", bucket, object, principal, expected, result })
  );
});

export default router;
