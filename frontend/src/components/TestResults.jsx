import { useState } from "react";
import Status from "./Status";

function passed(t) {
  if (t.type === "ACL_PROBE") return t.result.status === t.expected;
  if (t.type === "DOWNLOAD_AS" && t.expected) return t.result.status === Number(t.expected);
  return null;
}

function summary(t) {
  if (t.type === "TEST_PERMISSIONS") {
    const granted = Object.entries(t.result).filter(([, ok]) => ok).map(([p]) => p);
    return `Backend SA has ${granted.length}/${t.permissions.length}: ${granted.join(", ") || "none"}`;
  }
  if (t.type === "DOWNLOAD_AS") return `${t.principal} → ${t.object}: HTTP ${t.result.status}`;
  return `ACL API: HTTP ${t.result.status}`;
}

export default function TestResults({ tests, canRunDownload, onProbe, onPermissions, onDownload, busy }) {
  const [perms, setPerms] = useState("storage.objects.get, storage.objects.list");
  const [dl, setDl] = useState({ object: "", principal: "", expected: "206" });

  const splitPerms = () => perms.split(",").map((p) => p.trim()).filter(Boolean);

  return (
    <div>
      <div className="panels">
        <div className="panel">
          <p className="card-title">ACL API probe</p>
          <p className="muted small">Expects 400 Bad Request once UBLA is on.</p>
          <button className="btn" disabled={busy} onClick={onProbe}>Run probe</button>
        </div>

        <form className="panel" onSubmit={(e) => { e.preventDefault(); onPermissions(splitPerms()); }}>
          <p className="card-title">Effective permissions</p>
          <label className="field">
            <span>Permissions (comma separated)</span>
            <input className="input mono" value={perms} onChange={(e) => setPerms(e.target.value)} />
          </label>
          <button className="btn" disabled={busy}>Test</button>
        </form>

        {canRunDownload && (
          <form className="panel" onSubmit={(e) => { e.preventDefault(); onDownload(dl); }}>
            <p className="card-title">Download as service account</p>
            <label className="field">
              <span>Object</span>
              <input className="input mono" placeholder="reports/q3.csv" required
                value={dl.object} onChange={(e) => setDl({ ...dl, object: e.target.value })} />
            </label>
            <label className="field">
              <span>Service account</span>
              <input className="input mono" placeholder="reader@project.iam.gserviceaccount.com" required
                value={dl.principal} onChange={(e) => setDl({ ...dl, principal: e.target.value })} />
            </label>
            <label className="field">
              <span>Expected result</span>
              <select className="input" value={dl.expected} onChange={(e) => setDl({ ...dl, expected: e.target.value })}>
                <option value="206">Allowed (206)</option>
                <option value="403">Denied (403)</option>
              </select>
            </label>
            <button className="btn" disabled={busy}>Run</button>
          </form>
        )}
      </div>

      {!tests.length ? (
        <p className="empty">No test evidence recorded yet.</p>
      ) : (
        <ul className="list">
          {tests.map((t) => {
            const ok = passed(t);
            return (
              <li key={t.timestamp + t.type}>
                <Status tone={ok === null ? "info" : ok ? "good" : "critical"}>
                  {ok === null ? "Info" : ok ? "Pass" : "Fail"}
                </Status>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{t.type}</p>
                  <p className="mono small muted" style={{ wordBreak: "break-word" }}>{summary(t)}</p>
                  <p className="small muted">{new Date(t.timestamp).toLocaleString()} · {t.user}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
