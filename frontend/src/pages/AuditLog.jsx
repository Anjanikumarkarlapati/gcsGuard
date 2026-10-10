import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuditLog, errorMessage } from "../api/client";
import Status from "../components/Status";

export default function AuditLog() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAuditLog()
      .then((r) => setEntries(r.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Compliance</p>
        <h1 className="page-title">Audit log</h1>
        <p className="page-sub">Every IAM change and UBLA enablement, with before and after state.</p>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>User</th><th>Action</th><th>Bucket</th><th>Change</th></tr>
            </thead>
            <tbody>
              {!entries && !error && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
              {entries?.length === 0 && <tr><td colSpan={5} className="muted">No changes recorded yet.</td></tr>}
              {entries?.map((e, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(e.timestamp).toLocaleString()}</td>
                  <td>{e.user}</td>
                  <td><Status tone={e.action === "ENABLE_UBLA" ? "good" : "info"}>{e.action}</Status></td>
                  <td><Link to={`/buckets/${e.bucket}`} className="mono">{e.bucket}</Link></td>
                  <td style={{ minWidth: 280 }}>
                    {e.member && <p className="mono">{e.member} · {e.role}</p>}
                    <details style={{ marginTop: 4 }}>
                      <summary>Before / after</summary>
                      <div className="diff">
                        <pre>{JSON.stringify(e.before, null, 2)}</pre>
                        <pre>{JSON.stringify(e.after, null, 2)}</pre>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
