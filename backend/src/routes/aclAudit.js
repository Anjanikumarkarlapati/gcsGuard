import { Router } from "express";
import { auditBucketAclsAll } from "../services/auditService.js";

const router = Router();

router.get("/:bucketName", async (req, res) =>
  res.json(await auditBucketAclsAll(req.params.bucketName))
);

export default router;
