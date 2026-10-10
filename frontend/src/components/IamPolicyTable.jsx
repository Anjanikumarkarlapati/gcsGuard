import { useState } from "react";
import { X } from "@phosphor-icons/react";

export default function IamPolicyTable({ bindings, canEdit, onAdd, onRemove, busy }) {
  const [member, setMember] = useState("");
  const [role, setRole] = useState("roles/storage.objectViewer");

  const submit = (e) => {
    e.preventDefault();
    onAdd(member.trim(), role.trim()).then(() => setMember(""), () => {});
  };

  return (
    <div>
      {canEdit && (
        <form onSubmit={submit} className="inline-form">
          <label className="field">
            <span>Member</span>
            <input
              className="input mono"
              placeholder="group:t024-readers@example.com"
              value={member}
              onChange={(e) => setMember(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <input className="input mono" list="gcs-roles" value={role} onChange={(e) => setRole(e.target.value)} required />
          </label>
          <datalist id="gcs-roles">
            <option value="roles/storage.objectViewer" />
            <option value="roles/storage.objectCreator" />
            <option value="roles/storage.objectUser" />
            <option value="roles/storage.objectAdmin" />
            <option value="roles/storage.legacyBucketReader" />
            <option value="roles/storage.legacyBucketWriter" />
            <option value="roles/storage.admin" />
          </datalist>
          <button className="btn btn-primary" disabled={busy}>Add binding</button>
        </form>
      )}

      {!bindings.length ? (
        <p className="empty">No IAM bindings found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((b, i) => (
                <tr key={`${b.role}-${i}`}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {b.role}
                    {b.condition && <p className="muted small">if: {b.condition.title}</p>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      {b.members.map((m) => (
                        <span key={m} className="tag">
                          {m}
                          {canEdit && !b.condition && (
                            <button
                              type="button"
                              aria-label={`Remove ${m} from ${b.role}`}
                              disabled={busy}
                              onClick={() => onRemove(m, b.role)}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
