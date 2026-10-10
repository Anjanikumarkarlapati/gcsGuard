import Status from "./Status";

const ACTION_TONE = {
  REMOVE_OR_ISOLATE: "critical",
  MIGRATE_TO_IAM: "warning",
  REMOVE_ACL: "good",
};

export default function AclFindingsTable({ audit, canMigrate, onMigrate, busy }) {
  if (!audit) return <p className="empty">Running ACL audit…</p>;

  if (audit.ublaEnabled) {
    return (
      <p className="empty">
        UBLA is enabled: ACLs no longer grant access and the ACL API returns 400. Access is governed by IAM only.
      </p>
    );
  }

  if (!audit.findings.length) {
    return <p className="empty">No ACL findings. This bucket is ready for UBLA.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Scope</th>
            <th>Entity</th>
            <th>Permission</th>
            <th>Recommendation</th>
            <th>Suggested IAM binding</th>
            {canMigrate && <th />}
          </tr>
        </thead>
        <tbody>
          {audit.findings.map((f) => {
            const r = f.recommendation;
            return (
              <tr key={`${f.scope}:${f.entity}`}>
                <td className="muted small">{f.scope}</td>
                <td className="mono">{f.entity}</td>
                <td>{f.permission}</td>
                <td>
                  <Status tone={ACTION_TONE[r.action]}>{r.action}</Status>
                  <p className="muted small" style={{ marginTop: 4 }}>{r.reason}</p>
                </td>
                <td className="mono">
                  {r.suggestedRole ? (
                    <>
                      {r.suggestedMember}
                      <br />
                      <span style={{ color: "var(--accent)" }}>{r.suggestedRole}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                {canMigrate && (
                  <td className="right">
                    {r.action === "MIGRATE_TO_IAM" && r.suggestedRole && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => onMigrate(r.suggestedMember, r.suggestedRole)}
                      >
                        Migrate
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
