import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/issues", label: "All reports" },
  { to: "/admin/duplicates", label: "Duplicate review" },
  { to: "/admin/users", label: "Users" },
];

export default function AdminLayout() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Admin console</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive ? "border-brand text-brand" : "border-transparent text-ink/70 hover:text-ink"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
