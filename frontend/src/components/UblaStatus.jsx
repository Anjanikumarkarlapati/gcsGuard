import Status from "./Status";

export function UblaBadge({ enabled }) {
  return enabled ? <Status tone="good">UBLA enforced</Status> : <Status tone="critical">Fine-grained ACLs</Status>;
}

export default function UblaStatus({ bucket, blockingFindings, preflight, canEnable, onEnable, busy }) {
  const enabled = bucket.uniformBucketLevelAccess;
  const lock = bucket.ublaLockedTime && new Date(bucket.ublaLockedTime);
  const locked = lock && lock < new Date();
  // Other preflight failures (e.g. ACL usage seen in the last 24 months) also block enabling.
  const otherBlocks = (preflight?.checks ?? []).filter((c) => !c.passed && c.name !== "no-blocking-acl-findings" && c.name !== "uniform-access-disabled");
  const ready = blockingFindings === 0 && otherBlocks.length === 0;

  return (
    <div className={`advisory ${enabled ? "" : "critical"}`}>
      <div className="advisory-text">
        <div className="row">
          <UblaBadge enabled={enabled} />
          <p className="card-title">Uniform bucket-level access is {enabled ? "enabled" : "disabled"}</p>
        </div>
        <p className="muted">
          {enabled
            ? lock &&
              (locked
                ? `Permanently locked since ${lock.toLocaleString()}.`
                : `Can be rolled back until ${lock.toLocaleString()}; permanent after that.`)
            : blockingFindings > 0
              ? `${blockingFindings} unresolved ACL finding(s) must be migrated or removed first.`
              : otherBlocks.length > 0
                ? otherBlocks.map((c) => c.detail).join(" · ")
                : "No blocking ACL findings. Ready to enforce IAM-only access."}
        </p>
      </div>

      {!enabled && canEnable && (
        <button onClick={onEnable} disabled={busy || !ready} className="btn btn-primary">
          Enable UBLA
        </button>
      )}
    </div>
  );
}
