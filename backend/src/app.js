import express from "express";
import cors from "cors";

import bucketRoutes from "./routes/buckets.js";
import aclAuditRoutes from "./routes/aclAudit.js";
import iamRoutes from "./routes/iam.js";
import ublaRoutes from "./routes/ubla.js";
import testRoutes from "./routes/tests.js";
import migrationRoutes from "./routes/migrations.js";
import governanceRoutes from "./routes/governance.js";
import { requireAuth } from "./middleware/auth.js";
import { readLog } from "./middleware/audit.js";
import { isBucketAllowed } from "./config/gcp.js";

const app = express();

// ALLOWED_ORIGIN is a comma-separated list. Unlike cors({ origin: undefined }),
// an unset value falls back to the local dev origins, never to "*".
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:5364,http://127.0.0.1:5364")
  .split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

app.use(cors({
  // No Origin header means a non-browser client (curl, health checks): allow.
  origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)),
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600, // browsers may cache the preflight for 10 minutes
}));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", requireAuth);

// GCS bucket naming rules; rejects path tricks before they reach the SDK.
const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;
const BUCKET_SECTIONS = new Set(["buckets", "acl-audit", "iam", "ubla", "tests"]);
app.use("/api/:section/:bucketName", (req, res, next) => {
  if (!BUCKET_SECTIONS.has(req.params.section)) return next();
  if (!BUCKET_NAME.test(req.params.bucketName)) return res.status(400).json({ error: "Invalid bucket name" });
  if (!isBucketAllowed(req.params.bucketName)) return res.status(403).json({ error: "Bucket is outside GCP_BUCKET_ALLOWLIST" });
  next();
});

app.get("/api/me", (req, res) => res.json(req.user));
app.get("/api/audit-log", async (_req, res) => res.json(await readLog("audit")));

app.use("/api/buckets", bucketRoutes);
app.use("/api/acl-audit", aclAuditRoutes);
app.use("/api/iam", iamRoutes);
app.use("/api/ubla", ublaRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/migrations", migrationRoutes);
app.use("/api", governanceRoutes);

// GCP ApiErrors carry the HTTP status in `code` (400 for ACLs on UBLA, 403, 404...).
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message });
});

export default app;
