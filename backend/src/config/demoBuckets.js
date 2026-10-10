const daysFromNow = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

// Each bucket exists to demo one situation. Policies are keyed to the legacy
// roles the audit expects, so "ready" buckets really are ready.
const bucket = ({ name, team, location, storageClass, created, ubla = false, lockedTime = null, pap = "inherited", versioning = true, bucketAcl = [], defaultAcl = [], bindings = [], objects = [], aclUsage = 0 }) => ({
  aclUsage,
  metadata: {
    name, location, storageClass, timeCreated: created, labels: { team },
    iamConfiguration: { uniformBucketLevelAccess: ubla ? { enabled: true, lockedTime } : { enabled: false }, publicAccessPrevention: pap },
    versioning: { enabled: versioning },
  },
  bucketAcl, defaultAcl,
  policy: { version: 3, etag: "memory-v1", bindings },
  objects,
});

const obj = (name, size, updated, storageClass, acls = []) => ({ name, size: String(size), updated, storageClass, acls });

export const demoBuckets = [
  // ---- T024: student project team ----
  bucket({
    name: "t024-project-files", team: "T024", location: "US-CENTRAL1", storageClass: "STANDARD", created: "2026-01-15T10:00:00.000Z",
    bucketAcl: [{ entity: "project-owners-123456", role: "OWNER" }],
    defaultAcl: [{ entity: "group-t024-readers@example.com", role: "READER" }],
    bindings: [{ role: "roles/storage.admin", members: ["projectOwner:demo-project"] }],
    objects: [obj("readme.txt", 128, "2026-05-02T09:30:00.000Z", "STANDARD", [{ entity: "allUsers", role: "READER" }])],
  }),
  bucket({
    // Public bucket ACL plus a per-user WRITER: the worst case for the audit.
    name: "t024-student-uploads", team: "T024", location: "US-CENTRAL1", storageClass: "STANDARD", created: "2026-02-03T08:10:00.000Z", versioning: false,
    bucketAcl: [
      { entity: "allUsers", role: "READER" },
      { entity: "user-ravi.k@example.com", role: "WRITER" },
      { entity: "project-editors-123456", role: "OWNER" },
    ],
    defaultAcl: [{ entity: "allAuthenticatedUsers", role: "READER" }],
    bindings: [{ role: "roles/storage.admin", members: ["projectOwner:demo-project"] }],
    objects: [
      obj("submissions/lab1.pdf", 482_113, "2026-08-11T14:02:00.000Z", "STANDARD", [{ entity: "allUsers", role: "READER" }]),
      obj("submissions/lab2.pdf", 391_870, "2026-08-25T09:41:00.000Z", "STANDARD", [{ entity: "user-priya.s@example.com", role: "OWNER" }]),
      obj("submissions/notes.md", 4_096, "2026-09-02T16:20:00.000Z", "STANDARD"),
    ],
  }),
  bucket({
    // UBLA enabled and past its lock date: permanent.
    name: "t024-backups", team: "T024", location: "US-EAST1", storageClass: "COLDLINE", created: "2025-06-20T06:00:00.000Z",
    ubla: true, lockedTime: "2025-10-01T00:00:00.000Z", pap: "enforced",
    bindings: [
      { role: "roles/storage.objectViewer", members: ["group:t024-readers@example.com"] },
      { role: "roles/storage.objectAdmin", members: ["serviceAccount:backup-job@demo-project.iam.gserviceaccount.com"] },
    ],
    objects: [obj("db/2026-09-30.sql.gz", 52_428_800, "2026-09-30T02:00:00.000Z", "COLDLINE")],
  }),

  // ---- T124: analytics team ----
  bucket({
    name: "t124-analytics-data", team: "T124", location: "US-EAST1", storageClass: "NEARLINE", created: "2026-03-09T14:20:00.000Z", versioning: false,
    ubla: true, pap: "enforced",
    bindings: [{ role: "roles/storage.objectViewer", members: ["group:t124-analysts@example.com"] }],
    objects: [obj("reports/summary.csv", 2048, "2026-09-18T11:00:00.000Z", "NEARLINE")],
  }),
  bucket({
    // Every ACL already has its IAM twin: all REMOVE_ACL, so UBLA preflight passes.
    name: "t124-ml-models", team: "T124", location: "EUROPE-WEST1", storageClass: "STANDARD", created: "2026-04-02T12:00:00.000Z",
    bucketAcl: [
      { entity: "group-t124-ml@example.com", role: "WRITER" },
      { entity: "project-owners-123456", role: "OWNER" },
    ],
    defaultAcl: [{ entity: "group-t124-ml@example.com", role: "READER" }],
    bindings: [
      { role: "roles/storage.legacyBucketWriter", members: ["group:t124-ml@example.com"] },
      { role: "roles/storage.legacyBucketOwner", members: ["projectOwner:123456"] },
      { role: "roles/storage.legacyObjectReader", members: ["group:t124-ml@example.com"] },
      { role: "roles/storage.admin", members: ["projectOwner:demo-project"] },
    ],
    objects: [
      obj("models/churn-v3.pkl", 18_874_368, "2026-09-12T10:15:00.000Z", "STANDARD", [{ entity: "group-t124-ml@example.com", role: "READER" }]),
      obj("models/churn-v4.pkl", 19_922_944, "2026-10-01T10:15:00.000Z", "STANDARD"),
    ],
  }),
  bucket({
    // Domain, authenticated-users and group grants mixed together.
    name: "t124-customer-exports", team: "T124", location: "US-CENTRAL1", storageClass: "STANDARD", created: "2026-05-27T09:30:00.000Z",
    bucketAcl: [
      { entity: "domain-example.com", role: "READER" },
      { entity: "group-t124-finance@example.com", role: "READER" },
    ],
    defaultAcl: [{ entity: "allAuthenticatedUsers", role: "READER" }],
    bindings: [{ role: "roles/storage.admin", members: ["projectOwner:demo-project"] }],
    objects: [
      obj("exports/2026-09.csv", 1_048_576, "2026-10-01T00:05:00.000Z", "STANDARD", [{ entity: "domain-example.com", role: "READER" }]),
      obj("exports/2026-08.csv", 987_654, "2026-09-01T00:05:00.000Z", "STANDARD"),
    ],
  }),

  // ---- T224: research team ----
  bucket({
    name: "t224-archive", team: "T224", location: "ASIA-SOUTH1", storageClass: "COLDLINE", created: "2026-04-21T07:45:00.000Z",
    ubla: true, pap: "enforced",
    bindings: [{ role: "roles/storage.objectViewer", members: ["group:t224-archive-readers@example.com"] }],
  }),
  bucket({
    // UBLA enabled recently: still inside the 90-day rollback window, with a conditional binding.
    name: "t224-research-datasets", team: "T224", location: "ASIA-SOUTH1", storageClass: "STANDARD", created: "2026-06-10T05:30:00.000Z",
    ubla: true, lockedTime: daysFromNow(78), pap: "enforced",
    bindings: [
      { role: "roles/storage.objectViewer", members: ["group:t224-researchers@example.com"] },
      {
        role: "roles/storage.objectAdmin", members: ["user:dr.sagar@example.com"],
        condition: { title: "expires-2026-12-31", expression: 'request.time < timestamp("2026-12-31T00:00:00Z")' },
      },
    ],
    objects: [obj("survey/responses-2026.parquet", 73_400_320, "2026-09-29T13:00:00.000Z", "STANDARD")],
  }),
  bucket({
    // ACLs are already covered, but the 24-month ACL-usage metric is non-zero, so UBLA stays blocked.
    name: "t224-legacy-media", team: "T224", location: "ASIA-SOUTH1", storageClass: "STANDARD", created: "2025-02-14T11:00:00.000Z", versioning: false,
    aclUsage: 1873,
    bucketAcl: [{ entity: "group-t224-media@example.com", role: "READER" }],
    bindings: [
      { role: "roles/storage.legacyBucketReader", members: ["group:t224-media@example.com"] },
      { role: "roles/storage.admin", members: ["projectOwner:demo-project"] },
    ],
    objects: Array.from({ length: 12 }, (_, i) =>
      obj(`gallery/img-${String(i + 1).padStart(3, "0")}.jpg`, 250_000 + i * 31_337, `2026-0${(i % 9) + 1}-1${i % 9}T10:00:00.000Z`, "STANDARD")),
  }),
];

// Read by the ACL-dependency check so one sample can demonstrate a blocked UBLA.
export const demoAclUsage = (name) => demoBuckets.find((b) => b.metadata.name === name)?.aclUsage ?? 0;

// Enabling UBLA starts the 90-day rollback window, like real Cloud Storage.
export const rollbackDeadline = () => daysFromNow(90);
