import { Link } from "react-router-dom";
import { AclToIam, CloudBuckets, EvidenceReport, LockedBucket } from "../illustrations";
import Status from "../components/Status";

const PHASES = [
  {
    title: "1 · Audit",
    Art: AclToIam,
    intro: "Find every legacy ACL grant before anything changes.",
    steps: [
      ["Open a bucket", "On Buckets, pick a bucket that shows “Fine-grained ACLs” and press Open."],
      ["Read the ACL findings", "The ACL findings tab lists every bucket ACL and default object ACL, with a recommendation for each."],
      ["Check public grants first", "Anything marked REMOVE_OR_ISOLATE is open to allUsers or allAuthenticatedUsers. Move that data to a separate bucket or remove the grant."],
    ],
  },
  {
    title: "2 · Migrate & enforce",
    Art: LockedBucket,
    intro: "Give each person the same access through IAM, then switch ACLs off.",
    steps: [
      ["Migrate ACL-only access", "Press Migrate on a MIGRATE_TO_IAM row. This adds the suggested IAM role for that member. You can also add bindings yourself on the IAM policy tab."],
      ["Re-run the audit", "The audit refreshes on its own after every change. Migrated rows turn into REMOVE_ACL, which means IAM already covers them."],
      ["Enable UBLA", "Once no blocking findings remain, Enable UBLA unlocks. You can turn it off again for 90 days; after that it is permanent."],
    ],
  },
  {
    title: "3 · Prove it",
    Art: EvidenceReport,
    intro: "Record test evidence and export it for reviewers.",
    steps: [
      ["Probe the ACL API", "On the Tests tab, Run probe should now return 400 Bad Request. That proves ACLs are switched off."],
      ["Test downloads", "Download as an authorised service account (expect 206) and an unauthorised one (expect 403)."],
      ["Export the report", "Export migration report downloads the ACL inventory, IAM matrix, test evidence, change log and UBLA lock date as one JSON file."],
    ],
  },
];

const GLOSSARY = [
  ["ACL (Access Control List)", "The legacy per-bucket and per-object permission lists in Cloud Storage. They are hard to audit at scale."],
  ["IAM (Identity and Access Management)", "Google Cloud's role-based permissions. Each binding gives a role to a member (user, group or service account)."],
  ["UBLA (Uniform bucket-level access)", "A bucket setting that turns ACLs off, so only IAM decides who has access. It locks permanently 90 days after you enable it."],
  ["Public access prevention", "A bucket setting that blocks allUsers and allAuthenticatedUsers, even if someone tries to grant them access."],
];

const FAQ = [
  ["Why is the Enable UBLA button greyed out?", "The bucket still has MIGRATE_TO_IAM or REMOVE_OR_ISOLATE findings. Turning on UBLA now would silently cut off that access, so both the app and the API block it until they are resolved."],
  ["Why can't I see the Migrate or Add binding buttons?", "You are signed in as a read-only viewer. Only storage admins can change IAM, enable UBLA or run download tests."],
  ["The ACL findings tab says UBLA is enabled. Where did the findings go?", "Once UBLA is on, ACLs no longer grant any access and the ACL API returns 400, so there is nothing left to audit. IAM is the only source of truth."],
  ["Is every change recorded?", "Yes. Each IAM change and UBLA enablement is written to the Audit log, with who made it, when, and the policy before and after."],
];

export default function Guide() {
  return (
    <>
      <section className="guide-hero">
        <div>
          <p className="eyebrow">How to use GCS Guard</p>
          <h1 className="page-title">Move every bucket from ACLs to IAM, safely</h1>
          <p className="page-sub">
            GCS Guard walks your team through a Cloud Storage permissions migration: find legacy ACL grants, recreate them
            as IAM bindings, enforce uniform bucket-level access, and keep evidence that it worked.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to="/" className="btn btn-primary">Go to buckets</Link>
            <a href="#faq" className="btn">Read the FAQ</a>
          </div>
        </div>
        <div className="art-frame"><CloudBuckets /></div>
      </section>

      <section className="card card-body roles">
        <div>
          <h2 className="card-title">Who can do what</h2>
          <p className="muted">Your role is shown in the account pill at the top right.</p>
        </div>
        <div>
          <p className="role-name">Viewer</p>
          <p className="muted">Can see buckets, ACL findings, IAM policies, test evidence and the audit log, and can run read-only probes and permission checks.</p>
        </div>
        <div>
          <p className="role-name">Storage admin</p>
          <p className="muted">Can do everything a viewer can, plus add and remove IAM bindings, migrate findings, enable UBLA and run download tests as a service account.</p>
        </div>
      </section>

      <h2 className="section-title">The migration, step by step</h2>
      <div className="phases">
        {PHASES.map(({ title, Art, intro, steps }) => (
          <article key={title} className="card phase">
            <div className="art-frame small-art"><Art /></div>
            <div className="card-body">
              <h3 className="phase-title">{title}</h3>
              <p className="muted">{intro}</p>
              <ol className="steps">
                {steps.map(([name, text]) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <span className="muted">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>

      <h2 className="section-title">Reading the status labels</h2>
      <div className="card card-body legend">
        <div><Status tone="good">UBLA enforced</Status><p className="muted small">IAM only; ACLs are off. Also used for REMOVE_ACL findings and passed tests.</p></div>
        <div><Status tone="warning">MIGRATE_TO_IAM</Status><p className="muted small">This access exists only as an ACL. Migrate it before enabling UBLA.</p></div>
        <div><Status tone="critical">REMOVE_OR_ISOLATE</Status><p className="muted small">A public ACL, a bucket still on ACLs, or a failed test. Fix it first.</p></div>
        <div><Status tone="info">Info</Status><p className="muted small">Recorded evidence with no pass or fail, such as a permission check.</p></div>
      </div>

      <h2 className="section-title">Glossary</h2>
      <dl className="card card-body glossary">
        {GLOSSARY.map(([term, def]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd className="muted">{def}</dd>
          </div>
        ))}
      </dl>

      <h2 className="section-title" id="faq">Frequently asked questions</h2>
      <div className="card faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
