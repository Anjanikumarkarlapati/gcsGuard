import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { errorMessage } from "../api/client";
import { Wordmark } from "../components/Layout";
import { CloudBuckets } from "../illustrations";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const buttonRef = useRef(null);

  const tryLogin = (token) => login(token).catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    if (!CLIENT_ID) return;
    // The GSI script loads async from index.html; wait for it.
    const timer = setInterval(() => {
      if (!window.google?.accounts?.id) return;
      clearInterval(timer);
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: ({ credential }) => tryLogin(credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline",
        shape: "pill",
        size: "large",
        width: 320,
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="login">
      <section className="login-form">
        <Wordmark />
        <div>
          <h1 className="login-title">Sign in</h1>
          <p className="page-sub">Use your organisation Google account. Storage admins can change IAM; everyone else is read-only.</p>
        </div>

        {CLIENT_ID ? (
          <div ref={buttonRef} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <button onClick={() => tryLogin()} className="btn btn-primary">
              Continue in dev mode
            </button>
            <p className="muted small">
              Requires <code>AUTH_DISABLED=true</code> on the backend. Set <code>VITE_GOOGLE_CLIENT_ID</code> for Google Sign-In.
            </p>
          </div>
        )}

        {error && <p className="banner banner-error" role="alert">{error}</p>}
      </section>

      <section className="login-art" aria-hidden>
        <div className="login-photo">
          <div className="login-art-img"><CloudBuckets /></div>
          <h2>Every bucket, from ACLs to IAM, with evidence.</h2>
          <p>Audit legacy ACL grants, migrate them to IAM bindings and enforce uniform bucket-level access across T024, T124 and T224.</p>
          <ul className="login-points">
            <li>See which ACL grants still exist and what replaces each one</li>
            <li>Migrate access to IAM in one click, with every change logged</li>
            <li>Export test evidence and the UBLA lock date for reviewers</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
