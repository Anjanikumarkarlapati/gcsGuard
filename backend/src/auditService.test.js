import { test } from "node:test";
import assert from "node:assert/strict";
import { entityToMember, buildRecommendation } from "./services/auditService.js";

test("ACL entity -> IAM member", () => {
  assert.equal(entityToMember("user-a@x.com"), "user:a@x.com");
  assert.equal(entityToMember("group-t024-readers@x.com"), "group:t024-readers@x.com");
  assert.equal(entityToMember("project-viewers-123"), "projectViewer:123");
  assert.equal(entityToMember("allUsers"), "allUsers");
});

test("recommendations", () => {
  // IAM grants are keyed "role|member": an ACL is covered only by the exact equivalent role.
  const iam = new Set([
    "roles/storage.legacyBucketReader|group:g@x.com",
    "roles/storage.legacyBucketOwner|projectOwner:123",
  ]);
  const rec = (entity, role, scope = "BUCKET_ACL") =>
    buildRecommendation({ entity, role }, scope, iam);

  assert.equal(rec("allUsers", "READER").action, "REMOVE_OR_ISOLATE");
  assert.equal(rec("group-g@x.com", "READER").action, "REMOVE_ACL");
  assert.equal(rec("project-owners-123", "OWNER").action, "REMOVE_ACL");
  // Same member, but IAM only grants read: a WRITER ACL still needs migrating.
  assert.equal(rec("group-g@x.com", "WRITER").action, "MIGRATE_TO_IAM");

  const migrate = rec("user-a@x.com", "READER", "DEFAULT_OBJECT_ACL");
  assert.equal(migrate.action, "MIGRATE_TO_IAM");
  assert.equal(migrate.suggestedMember, "user:a@x.com");
  assert.equal(migrate.suggestedRole, "roles/storage.legacyObjectReader");
  assert.equal(rec("user-a@x.com", "WRITER").suggestedRole, "roles/storage.legacyBucketWriter");
});
