# GCS Guard

GCS Guard is an IAM and ACL rationalisation dashboard with a modular Express backend and React frontend. Local development uses a seeded in-memory storage adapter, so the API can be developed and demonstrated without GCP credentials. Select `STORAGE_PROVIDER=gcp` only when you are ready to connect a GCP project and its credentials.

## Run locally

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
# Set AUTH_DISABLED=true in backend/.env for local development.
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run dev
npm --prefix frontend run dev
```

The API listens on port 8080 and the frontend on port 5364. The in-memory sample has buckets for T024, T124, and T224; it resets when the backend restarts. Audit logs, test evidence, migration plans, and finding statuses are written under `backend/data/` for local review.

## Backend applications

1. **Storage Security Discovery** — bucket inventory, IAM policy, bucket/default/object ACL findings, exposure risk summaries, and reports.
2. **ACL-to-IAM Migration** — plan generation, admin approval, application of IAM bindings and ACL removals, plan status, and rollback before UBLA.
3. **UBLA Enforcement** — readiness preflight, exact admin confirmation, enablement, and status. Local mode simulates the ACL usage metric; GCP mode queries the Cloud Monitoring `OBJECT_ACCESS_REQUIRED_OBJECT_ACL` series before allowing enablement.
4. **Access Validation** — permission checks and ACL probes are available locally; principal impersonation tests require GCP credentials.
5. **Governance & Audit** — audit events, test evidence, finding lifecycle, compliance summary, and CSV/PDF/JSON report endpoints.

All application routes are under `/api` and use the same Google ID token authentication. Set `AUTH_DISABLED=true` only for local development. The local persistence files are for development and are not a production audit store.

## Key endpoints

```text
GET  /api/buckets
GET  /api/buckets/:bucketName/acl-inventory
GET  /api/buckets/:bucketName/risk-summary
POST /api/migrations/plans
POST /api/migrations/plans/:planId/approve
POST /api/migrations/plans/:planId/apply
POST /api/migrations/plans/:planId/rollback
GET  /api/ubla/:bucketName/preflight
POST /api/ubla/:bucketName/enable       { "confirmation": "ENABLE UBLA" }
GET  /api/tests/:bucketName
GET  /api/audit-logs
GET  /api/findings
PATCH /api/findings/:findingId
GET  /api/compliance
GET  /api/buckets/:bucketName/reports/migration?format=csv
GET  /api/buckets/:bucketName/reports/migration?format=pdf
GET  /api/buckets/:bucketName/reports/iam-matrix?format=csv
```

Migration and UBLA mutations require an admin user. Public principals cannot be added as IAM bindings through the API. Enabling UBLA is blocked until blocking ACL findings are resolved. The rollback route restores ACLs removed by a plan and removes IAM bindings it added.

## Minimal GCP connection (optional)

You can run the app locally and connect it directly to existing GCP buckets. This does not create buckets, service accounts, Cloud Run services, Cloud Scheduler jobs, or storage uploads. The GCP adapter requires a bucket allowlist and scans at most `GCP_MAX_OBJECT_ACLS` objects per bucket (default 100); if a scan is incomplete, UBLA preflight and migration apply remain blocked. Each scanned object requires an ACL read, and Cloud Storage operations may incur charges. Start with the small default and raise it only when you need a complete inventory for a bucket. Set the limit to `0` only when you intentionally want an unlimited full scan.

1. Use Cloud Shell or a local terminal with the Google Cloud CLI. Select the project that already contains the three team buckets, then obtain their exact names with `gcloud storage buckets list --project=PROJECT_ID`.
2. Enable only the APIs used by this local integration:

   ```bash
   gcloud services enable storage.googleapis.com monitoring.googleapis.com --project=PROJECT_ID
   ```

3. Sign in and create local Application Default Credentials (ADC):

   ```bash
   gcloud auth application-default login
   ```

   The signed-in user needs `storage.buckets.get`, `storage.buckets.getIamPolicy`, `storage.objects.list`, and `storage.objects.getIamPolicy` on the allowlisted buckets, plus `monitoring.timeSeries.list` for the project. A project-level `roles/monitoring.viewer` is a straightforward way to read the Monitoring series. Avoid granting broad project roles just to make the first scan work. If you later enable mutations, the app also needs the relevant `storage.buckets.setIamPolicy`, `storage.buckets.update`, `storage.objects.setIamPolicy`, and `storage.objects.update` permissions.
4. In `backend/.env`, set `STORAGE_PROVIDER=gcp`, `GCP_PROJECT_ID`, and `GCP_BUCKET_ALLOWLIST` to the exact three bucket names. Keep `GCP_ALLOW_MUTATIONS=false`. Remove or comment out `GOOGLE_APPLICATION_CREDENTIALS` when using ADC so the backend does not look for a key file.
5. Run the backend and frontend locally. `GET /api/buckets` reads metadata only for the allowlisted bucket names; ACL inventory is limited by `GCP_MAX_OBJECT_ACLS`. The UBLA preflight checks ACL inventory and queries the 24-month Monitoring interval. Avoid repeatedly refreshing a full object ACL audit; the scan performs one ACL read per listed object. Cloud Storage operations can be billable, and Monitoring read API charges depend on returned time series, so check current [Cloud Storage pricing](https://cloud.google.com/storage/pricing) and [Cloud Monitoring pricing](https://cloud.google.com/products/observability/pricing) before broad scans.

GCP writes are disabled by default. To allow IAM or UBLA changes later, first configure Google ID-token authentication (`AUTH_DISABLED=false`, `GOOGLE_CLIENT_ID`, frontend `VITE_GOOGLE_CLIENT_ID`, and `ADMIN_EMAILS`), grant only the needed write permissions, then set `GCP_ALLOW_MUTATIONS=true`. The API rejects GCP mutation requests when auth is disabled. Keep this flag false for discovery and report generation.

No Cloud Run, Cloud Build, Cloud Scheduler, Logging API, or new service account is needed for the local workflow. The ACL-usage metric is documented as tracking the last 24 months; if your bucket has not had representative application traffic in that period, do not treat a zero result as proof that future workflows are ACL-independent.
