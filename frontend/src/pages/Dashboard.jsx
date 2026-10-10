import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { getBuckets, errorMessage } from "../api/client";
import { UblaBadge } from "../components/UblaStatus";
import Status from "../components/Status";
import { AclToIam, CloudBuckets } from "../illustrations";

function Tile({ title, value, note }) {
  return (
    <div className="card bento-card">
      <p className="card-title">{title}</p>
      <p className="tile-number">{value}</p>
      <p className="muted small">{note}</p>
    </div>
  );
}

export default function Dashboard() {
  const [buckets, setBuckets] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getBuckets()
      .then((res) => setBuckets(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const list = buckets ?? [];
  const shown = list.filter((b) => b.name.includes(query.trim().toLowerCase()));
  const ubla = list.filter((b) => b.uniformBucketLevelAccess).length;
  const pap = list.filter((b) => b.publicAccessPrevention === "enforced").length;
  const versioned = list.filter((b) => b.versioning).length;
  const n = (v) => (buckets ? v : "–");

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Storage security</p>
        <h1 className="page-title">IAM vs ACL rationalisation</h1>
        <p className="page-sub">
          Monitor ACL findings, IAM bindings and uniform bucket-level access for T024, T124 and T224.
        </p>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <section className="hero">
        <div className="hero-panel">
          <div>
            <p className="hero-label">Buckets on uniform access</p>
            <p className="hero-number">
              {n(ubla)}
              <small> / {n(list.length)}</small>
            </p>
            <p className="hero-legend">Tall stems: UBLA enforced · short stems: still on ACLs</p>
          </div>
          <div className="hero-art"><CloudBuckets /></div>
          <div className="stems" aria-hidden>
            {list.map((b, i) => (
              <span key={b.name} className={`stem ${b.uniformBucketLevelAccess ? "on" : ""}`} style={{ "--i": i }} />
            ))}
          </div>
        </div>
      </section>

      <div className="bento">
        <Tile title="Still on ACLs" value={n(list.length - ubla)} note="Need an ACL audit before UBLA" />
        <Tile title="Public access blocked" value={n(pap)} note="Public access prevention enforced" />
        <Tile title="Versioning on" value={n(versioned)} note="Recoverable after accidental deletes" />
      </div>

      <section className="card getting-started">
        <div className="art-frame small-art"><AclToIam /></div>
        <div className="card-body">
          <h2 className="card-title">New here? Migrating a bucket takes three steps</h2>
          <ol className="quick-steps">
            <li><strong>Audit</strong><span className="muted">Open a bucket on ACLs and review its ACL findings.</span></li>
            <li><strong>Migrate</strong><span className="muted">Move ACL-only access into IAM roles, then enable UBLA.</span></li>
            <li><strong>Prove</strong><span className="muted">Run the tests and export the migration report.</span></li>
          </ol>
          <Link to="/guide" className="btn btn-sm">Read the full guide <ArrowRight size={14} /></Link>
        </div>
      </section>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bucket inventory</h2>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Filter buckets…"
            aria-label="Filter buckets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Location</th>
                <th>Class</th>
                <th>Access control</th>
                <th>Public access prevention</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!buckets && !error && (
                <tr><td colSpan={6} className="muted">Loading buckets…</td></tr>
              )}
              {buckets && !shown.length && (
                <tr><td colSpan={6} className="muted">No buckets match.</td></tr>
              )}
              {shown.map((b) => (
                <tr key={b.name}>
                  <td className="mono" style={{ fontWeight: 500 }}>{b.name}</td>
                  <td>{b.location}</td>
                  <td>{b.storageClass}</td>
                  <td><UblaBadge enabled={b.uniformBucketLevelAccess} /></td>
                  <td>
                    <Status tone={b.publicAccessPrevention === "enforced" ? "good" : "muted"}>
                      {b.publicAccessPrevention}
                    </Status>
                  </td>
                  <td className="right">
                    <Link to={`/buckets/${b.name}`} className="btn btn-sm">
                      Open <ArrowRight size={14} />
                    </Link>
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
