import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Moon, SignOut, Sun } from "@phosphor-icons/react";
import { useAuth } from "../auth";

export function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || "light");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#1c1c12" : "#fdfbd4");
    try {
      localStorage.setItem("gcsguard.theme", next);
    } catch {}
    setTheme(next);
  };
  return [theme, toggle];
}

export function Wordmark() {
  return (
    <Link to="/" className="wordmark">
      GCS<span>Guard</span>
    </Link>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();

  return (
    <>
      <header className="topbar">
        <Wordmark />
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Buckets</NavLink>
          <NavLink to="/audit-log">Audit log</NavLink>
          <NavLink to="/guide">How to use</NavLink>
        </nav>
        <div className="topbar-actions">
          <button
            className="btn btn-quiet btn-icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <span className="account-pill" title={user.email}>
            <span className="account-name">{user.email}</span>
            <span className="account-role">{isAdmin ? "admin" : "viewer"}</span>
          </span>
          <button className="btn btn-quiet btn-icon" onClick={logout} aria-label="Sign out">
            <SignOut size={20} />
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
