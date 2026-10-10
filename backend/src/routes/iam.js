import { Router } from "express";
import {
  getBucketIamPolicy,
  addBucketIamBinding,
  removeBucketIamBinding,
  testBucketPermissions,
} from "../services/iamService.js";
import { requireAdmin, requireCloudMutationEnabled } from "../middleware/auth.js";
import { logChange, recordTest } from "../middleware/audit.js";

const router = Router();

const MEMBER = /^(user|group|serviceAccount|domain|principal|principalSet|projectOwner|projectEditor|projectViewer):[^\s,]+$/;
const ROLE = /^(roles|projects\/[^/]+\/roles|organizations\/[^/]+\/roles)\/[A-Za-z0-9_.]+$/;

function validBinding(req, res) {
  const { member, role } = req.body ?? {};
  if (!MEMBER.test(member ?? "") || !ROLE.test(role ?? "")) {
    res.status(400).json({
      error: "member (e.g. group:team@example.com) and role (e.g. roles/storage.objectViewer) are required. Public members are not allowed.",
    });
    return null;
  }
  return { member, role };
}

router.get("/:bucketName/policy", async (req, res) =>
  res.json(await getBucketIamPolicy(req.params.bucketName))
);

router.post("/:bucketName/bindings", requireAdmin, requireCloudMutationEnabled, async (req, res) => {
  const binding = validBinding(req, res);
  if (!binding) return;
  const bucket = req.params.bucketName;
  const { before, after } = await addBucketIamBinding(bucket, binding.member, binding.role);
  await logChange(req, { action: "ADD_IAM_BINDING", bucket, ...binding, before, after });
  res.json(after);
});

router.delete("/:bucketName/bindings", requireAdmin, requireCloudMutationEnabled, async (req, res) => {
  const binding = validBinding(req, res);
  if (!binding) return;
  const bucket = req.params.bucketName;
  const { before, after } = await removeBucketIamBinding(bucket, binding.member, binding.role);
  await logChange(req, { action: "REMOVE_IAM_BINDING", bucket, ...binding, before, after });
  res.json(after);
});

router.post("/:bucketName/test-permissions", async (req, res) => {
  const { permissions } = req.body ?? {};
  if (!Array.isArray(permissions) || !permissions.length) {
    return res.status(400).json({ error: "permissions must be a non-empty array" });
  }
  const bucket = req.params.bucketName;
  const result = await testBucketPermissions(bucket, permissions);
  await recordTest(req, { type: "TEST_PERMISSIONS", bucket, permissions, result });
  res.json(result);
});

export default router;
