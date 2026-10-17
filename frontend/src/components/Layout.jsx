import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui.jsx";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
          <path d="m9 10 2 2 4-4" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold">Civic Fix</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/issues", label: "Reports" },
    { to: "/map", label: "Map" },
    { to: "/stats", label: "Statistics" },
    ...(user?.role === "citizen" ? [{ to: "/dashboard", label: "My dashboard" }] : []),
    ...(user && user.role !== "citizen" ? [{ to: "/manage", label: "Manage" }] : []),
  ];

  const linkClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-brand/10 text-brand" : "text-ink/75 hover:text-ink"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                {user.role === "citizen" && (
                  <Button variant="accent" onClick={() => navigate("/report")}>+ Report issue</Button>
                )}
                <div className="text-right leading-tight">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs capitalize text-muted">
                    {user.role}{user.team ? ` · ${user.team}` : ""}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => { logout(); navigate("/"); }}>Log out</Button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-ink/80 hover:text-ink">Log in</Link>
                <Button onClick={() => navigate("/register")}>Sign up</Button>
              </>
            )}
          </div>

          <button className="md:hidden rounded-md p-2 cursor-pointer" onClick={() => setOpen(!open)} aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {open && (
          <div className="border-t border-line px-4 pb-4 pt-2 md:hidden" onClick={() => setOpen(false)}>
            <div className="flex flex-col">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
              ))}
              {user?.role === "citizen" && <NavLink to="/report" className={linkClass}>+ Report issue</NavLink>}
              {user ? (
                <button className="px-3 py-2 text-left text-sm font-medium text-critical cursor-pointer"
                        onClick={() => { logout(); navigate("/"); }}>
                  Log out ({user.name})
                </button>
              ) : (
                <>
                  <NavLink to="/login" className={linkClass}>Log in</NavLink>
                  <NavLink to="/register" className={linkClass}>Sign up</NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-muted">
        Civic Fix · Report it. Track it. Get it fixed.
      </footer>
    </div>
  );
}
