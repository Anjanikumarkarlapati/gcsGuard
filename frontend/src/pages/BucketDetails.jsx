import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react";
import * as api from "../api/client";
import { useAuth } from "../auth";
import UblaStatus from "../components/UblaStatus";
import AclFindingsTable from "../components/AclFindingsTable";
import IamPolicyTable from "../components/IamPolicyTable";
import TestResults from "../components/TestResults";

const TABS = ["ACL findings", "IAM policy", "Tests", "Objects"];

const TAB_HELP = {
  "ACL findings": "Every legacy ACL on this bucket, with what to do about it. Resolve all warning and critical rows before enabling UBLA.",
  "IAM policy": "Who has which role on this bucket. Migrated ACL access shows up here; admins can add or remove members.",
  Tests: "Record evidence: the ACL probe should return 400 after UBLA, and downloads should return 206 for allowed and 403 for denied accounts.",
  Objects: "The first 100 objects in the bucket, for picking a file to use in download tests.",
};

export default function BucketDetails() {
  const { bucketName } = useParams();
  const { isAdmin } = useAuth();

  const [bucket, setBucket] = useState(null);
  const [audit, setAudit] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [tests, setTests] = useState([]);
  const [preflight, setPreflight] = useState(null);
  const [objects, setObjects] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    const [b, a, p, t, pf] = await Promise.all([
      api.getBucket(bucketName),
      api.auditAcls(bucketName),
      api.getIamPolicy(bucketName),
      api.getTests(bucketName),
      api.getUblaPreflight(bucketName),
    ]);
    setBucket(b.data);
    setAudit(a.data);
    setPolicy(p.data);
    setTests(t.data);
    setPreflight(pf.data);
  };

  useEffect(() => {
    loadAll().catch((err) => setMessage({ error: true, text: api.errorMessage(err) }));
  }, [bucketName]);

  useEffect(() => {
    if (tab === "Objects" && !objects) {
      api.getObjects(bucketName).then((r) => setObjects(r.data)).catch(() => setObjects([]));
    }
  }, [tab]);

  // Runs an action, shows the outcome, and reloads so the audit reflects it.
  const run = async (fn, success) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (success) setMessage({ text: success });
      await loadAll();
    } catch (err) {
      setMessage({ error: true, text: api.errorMessage(err) });
      throw err;
    } finally {
      setBusy(false);
    }
  };
  const quiet = (p) => p.catch(() => {});

  const addBinding = (member, role) =>
    run(() => api.addIamBinding(bucketName, member, role), `Granted ${role} to ${member}. Audit re-run.`);

  const removeBinding = (member, role) => {
    if (!window.confirm(`Remove ${member} from ${role}?`)) return;
    quiet(run(() => api.removeIamBinding(bucketName, member, role), `Removed ${member} from ${role}.`));
  };

  const handleEnableUbla = () => {
    const ok = window.confirm(
      `Enable uniform bucket-level access on ${bucketName}?\n\n` +
        "All ACL-based access is revoked immediately. This change may become irreversible after 90 days."
    );
    if (ok) quiet(run(() => api.enableUbla(bucketName), "UBLA enabled. ACLs no longer grant access."));
  };

  const exportReport = async () => {
    const { data } = await api.getReport(bucketName);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${bucketName}-migration-report-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const back = (
    <Link to="/" className="back-link">
      <ArrowLeft size={16} className="flip-rtl" /> All buckets
    </Link>
  );

  if (!bucket) {
    return (
      <>
        {back}
        {message ? <p className="banner banner-error" role="alert">{message.text}</p> : <p className="empty">Loading…</p>}
      </>
    );
  }

  return (
    <>
      {back}

      <header className="page-head row spread" style={{ alignItems: "flex-end", marginTop: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">Bucket</p>
          <h1 className="page-title mono-title">{bucket.name}</h1>
          <p className="page-sub">
            {bucket.location} · {bucket.storageClass} · versioning {bucket.versioning ? "on" : "off"} · public access
            prevention {bucket.publicAccessPrevention}
          </p>
        </div>
        <button className="btn" onClick={() => quiet(run(exportReport))} disabled={busy}>
          <DownloadSimple size={20} /> Export migration report
        </button>
      </header>

      <UblaStatus
        bucket={bucket}
        blockingFindings={audit?.blockingFindings ?? 0}
        preflight={preflight}
        canEnable={isAdmin}
        onEnable={handleEnableUbla}
        busy={busy}
      />

      {message && (
        <p role="status" className={`banner ${message.error ? "banner-error" : "banner-ok"}`}>
          {message.text}
        </p>
      )}

      <div className="card">
        <div role="tablist" className="tabs">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="tab">
              {t}
              {t === "ACL findings" && audit?.blockingFindings > 0 && <span className="count">{audit.blockingFindings}</span>}
            </button>
          ))}
        </div>

        <p className="tab-help">
          {TAB_HELP[tab]} <Link to="/guide">How it works</Link>
        </p>

        {tab === "ACL findings" && (
          <AclFindingsTable audit={audit} canMigrate={isAdmin} onMigrate={(m, r) => quiet(addBinding(m, r))} busy={busy} />
        )}

        {tab === "IAM policy" && (
          <IamPolicyTable
            bindings={policy?.bindings || []}
            canEdit={isAdmin}
            onAdd={addBinding}
            onRemove={removeBinding}
            busy={busy}
          />
        )}

        {tab === "Tests" && (
          <TestResults
            tests={tests}
            canRunDownload={isAdmin}
            busy={busy}
            onProbe={() => quiet(run(() => api.runAclProbe(bucketName), "ACL probe recorded."))}
            onPermissions={(p) => quiet(run(() => api.testPermissions(bucketName, p), "Permission test recorded."))}
            onDownload={(body) => quiet(run(() => api.runDownloadAs(bucketName, body), "Download test recorded."))}
          />
        )}

        {tab === "Objects" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Object</th><th>Size</th><th>Class</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {!objects && <tr><td colSpan={4} className="muted">Loading…</td></tr>}
                {objects?.length === 0 && <tr><td colSpan={4} className="muted">No objects.</td></tr>}
                {objects?.map((o) => (
                  <tr key={o.name}>
                    <td className="mono" style={{ wordBreak: "break-all" }}>{o.name}</td>
                    <td className="mono">{o.size.toLocaleString()} B</td>
                    <td>{o.storageClass}</td>
                    <td>{new Date(o.updated).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {objects?.length === 100 && <p className="muted small" style={{ padding: "12px 20px" }}>Showing the first 100 objects.</p>}
          </div>
        )}
      </div>
    </>
  );
}
