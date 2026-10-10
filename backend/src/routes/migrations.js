import { Router } from "express";
import { requireAdmin, requireCloudMutationEnabled } from "../middleware/auth.js";
import { logChange } from "../middleware/audit.js";
import { addBucketIamBinding, getBucketIamPolicy, removeBucketIamBinding } from "../services/iamService.js";
import { changePlanStatus, createPlan, getPlan, listPlans, removeAclAction, restoreAclAction } from "../services/migrationService.js";
import { setFindingStatus } from "../services/governanceService.js";
import { getBucketDetails } from "../services/storageService.js";

const router = Router();

async function markPlanFindings(plan, actions, status, actor, note) {
  const snapshots = new Map((plan.findings || []).map((finding) => [finding.id, finding]));
  for (const action of actions) for (const findingId of action.sourceFindings || []) {
    await setFindingStatus(findingId, status, actor, { ...snapshots.get(findingId), note });
  }
}

router.get("/plans", async (_req, res) => res.json(await listPlans()));

router.post("/plans", requireAdmin, async (req, res) => {
  const bucketName = req.body?.bucketName;
  if (typeof bucketName !== "string") return res.status(400).json({ error: "bucketName is required" });
  const plan = await createPlan(bucketName, req.user.email);
  await markPlanFindings(plan, plan.actions, "OPEN", req.user.email, `Included in migration plan ${plan.planId}`);
  res.status(201).json(plan);
});

router.get("/plans/:planId", async (req, res) => {
  const plan = await getPlan(req.params.planId);
  return plan ? res.json(plan) : res.status(404).json({ error: "Migration plan not found" });
});

router.get("/plans/:planId/status", async (req, res) => {
  const plan = await getPlan(req.params.planId);
  return plan ? res.json({ planId: plan.planId, status: plan.status, updatedAt: plan.updatedAt }) : res.status(404).json({ error: "Migration plan not found" });
});

router.post("/plans/:planId/approve", requireAdmin, async (req, res) => {
  const plan = await getPlan(req.params.planId);
  if (!plan) return res.status(404).json({ error: "Migration plan not found" });
  if (plan.status !== "PENDING_APPROVAL") return res.status(409).json({ error: `Cannot approve a plan in ${plan.status} state` });
  const approved = await changePlanStatus(plan, "APPROVED", req.user.email);
  await logChange(req, { action: "MIGRATION_PLAN_APPROVED", bucket: plan.bucketName, planId: plan.planId });
  res.json(approved);
});

router.post("/plans/:planId/apply", requireAdmin, requireCloudMutationEnabled, async (req, res) => {
  const plan = await getPlan(req.params.planId);
  if (!plan) return res.status(404).json({ error: "Migration plan not found" });
  if (plan.status !== "APPROVED") return res.status(409).json({ error: "Plan must be approved before it can be applied" });
  if (!plan.inventoryComplete) return res.status(409).json({ error: "The ACL scan reached GCP_MAX_OBJECT_ACLS. Raise the limit and create a fresh complete plan before applying changes." });
  const manualActions = plan.actions.filter((action) => action.actionType === "MANUAL_REVIEW");
  if (manualActions.length) return res.status(409).json({ error: "Resolve manual-review actions before applying this plan", actions: manualActions });
  const [bucketState, currentPolicy] = await Promise.all([getBucketDetails(plan.bucketName), getBucketIamPolicy(plan.bucketName)]);
  if (bucketState.uniformBucketLevelAccess) return res.status(409).json({ error: "Cannot apply an ACL migration plan after UBLA is enabled" });
  if (plan.iamPolicyEtag && currentPolicy.etag !== plan.iamPolicyEtag) return res.status(409).json({ error: "IAM policy changed after this plan was created; generate and approve a fresh plan" });
  const applied = [];
  const removedAcls = [];
  try {
    for (const action of plan.actions) {
      if (action.actionType === "ADD_IAM_BINDING") {
        const result = await addBucketIamBinding(plan.bucketName, action.member, action.role);
        const alreadyPresent = result.before.bindings.some((binding) => binding.role === action.role && !binding.condition && binding.members.includes(action.member));
        applied.push({ member: action.member, role: action.role, added: !alreadyPresent, sourceFindings: action.sourceFindings, before: result.before, after: result.after });
      } else if (action.actionType === "REMOVE_ACL") {
        const result = await removeAclAction(plan.bucketName, action);
        removedAcls.push({ ...action, before: result.before });
      }
    }
  } catch (error) {
    const partial = await changePlanStatus({ ...plan, appliedBindings: applied, removedAcls, applyError: error.message }, "PARTIAL_FAILURE", req.user.email);
    await markPlanFindings(plan, [...applied, ...removedAcls], "RESOLVED", req.user.email, `Applied by partial migration plan ${plan.planId}`);
    await logChange(req, { action: "MIGRATION_PLAN_PARTIAL_FAILURE", bucket: plan.bucketName, planId: plan.planId, error: error.message });
    return res.status(502).json(partial);
  }
  const updated = await changePlanStatus({ ...plan, appliedBindings: applied, removedAcls }, "APPLIED", req.user.email);
  await markPlanFindings(plan, [...applied, ...removedAcls], "RESOLVED", req.user.email, `Applied migration plan ${plan.planId}`);
  await logChange(req, { action: "MIGRATION_PLAN_APPLIED", bucket: plan.bucketName, planId: plan.planId, appliedBindings: applied, removedAcls });
  res.json(updated);
});

router.post("/plans/:planId/rollback", requireAdmin, requireCloudMutationEnabled, async (req, res) => {
  const plan = await getPlan(req.params.planId);
  if (!plan) return res.status(404).json({ error: "Migration plan not found" });
  if (!["APPLIED", "PARTIAL_FAILURE"].includes(plan.status)) return res.status(409).json({ error: "Only applied or partially applied plans can be rolled back" });
  const bucketState = await getBucketDetails(plan.bucketName);
  if (bucketState.uniformBucketLevelAccess) return res.status(409).json({ error: "Rollback is available only before UBLA is enabled" });
  const removed = [];
  for (const binding of (plan.appliedBindings || []).filter((item) => item.added)) {
    const result = await removeBucketIamBinding(plan.bucketName, binding.member, binding.role);
    removed.push({ member: binding.member, role: binding.role, before: result.before, after: result.after });
  }
  for (const action of plan.removedAcls || []) await restoreAclAction(plan.bucketName, action);
  await markPlanFindings(plan, [...(plan.appliedBindings || []), ...(plan.removedAcls || [])], "OPEN", req.user.email, `Restored by rollback of migration plan ${plan.planId}`);
  const updated = await changePlanStatus({ ...plan, rollback: { at: new Date().toISOString(), bindings: removed, restoredAcls: plan.removedAcls || [] } }, "ROLLED_BACK", req.user.email);
  await logChange(req, { action: "MIGRATION_PLAN_ROLLED_BACK", bucket: plan.bucketName, planId: plan.planId, removedBindings: removed, restoredAcls: plan.removedAcls || [] });
  res.json(updated);
});

export default router;
