import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../lib/adminApi.js";
import { api } from "../../lib/api.js";
import { PRIORITY_CLS, STATUS_META, formatHours } from "../../lib/format.js";
import { errMsg } from "../../components/admin/bits.jsx";
import { Alert, Card, PageLoader } from "../../components/ui.jsx";

const STATUSES = ["reported", "assigned", "in_progress", "resolved", "duplicate"];

function Tile({ label, value, to, tone }) {
  const body = (
    <Card className={`p-5 ${to ? "transition hover:border-brand" : ""}`}>
      <div className={`text-3xl font-bold ${tone || ""}`}>{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    // Status totals come from the list endpoint's `total` (page_size=1 keeps it cheap).
    Promise.all([
      adminApi.overview(),
      api.get("/stats"),
      ...STATUSES.map((s) => adminApi.issues({ status: s, page_size: 1 })),
    ])
      .then(([overview, stats, ...pages]) => {
        if (off) return;
        setData({ overview, stats, counts: Object.fromEntries(STATUSES.map((s, i) => [s, pages[i].total])) });
      })
      .catch((e) => !off && setError(errMsg(e)));
    return () => { off = true; };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;
  const { overview, stats, counts } = data;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Needs your attention</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile label="Open reports with no team" value={overview.unassigned_open}
                to="/admin/issues?unassigned=1" tone={overview.unassigned_open ? "text-high" : ""} />
          <Tile label="Reports flagged as possible duplicates" value={overview.pending_duplicate_reviews}
                to="/admin/duplicates" tone={overview.pending_duplicate_reviews ? "text-high" : ""} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Reports by status</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {STATUSES.map((s) => (
            <Tile key={s} label={STATUS_META[s].label} value={counts[s]} to={`/admin/issues?status=${s}`} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Resolution performance</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile label="Resolution rate" value={`${stats.resolution_rate}%`} />
          <Tile label="Average time to resolve" value={formatHours(stats.avg_resolution_hours)} />
          <Tile label="Median time to resolve" value={formatHours(stats.median_resolution_hours)} />
          <Tile label="Duplicates merged" value={stats.duplicates_merged} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Open reports by priority</h2>
          <Card className="flex flex-wrap gap-3 p-5">
            {Object.entries(stats.open_by_priority).map(([label, n]) => (
              <span key={label} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${PRIORITY_CLS[label] || ""}`}>
                {label}: {n}
              </span>
            ))}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Team workload</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Team</th>
                  <th className="px-4 py-2.5 font-medium">Open</th>
                  <th className="px-4 py-2.5 font-medium">Resolved</th>
                  <th className="px-4 py-2.5 font-medium">Avg. fix time</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.by_team).map(([team, t]) => (
                  <tr key={team} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{team}</td>
                    <td className="px-4 py-2.5">{t.open}</td>
                    <td className="px-4 py-2.5">{t.resolved}</td>
                    <td className="px-4 py-2.5">{formatHours(t.avg_resolution_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Users</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile label="Citizens" value={overview.users.citizen} to="/admin/users?role=citizen" />
          <Tile label="Team members" value={overview.users.team} to="/admin/users?role=team" />
          <Tile label="Admins" value={overview.users.admin} to="/admin/users?role=admin" />
          <Tile label="Banned" value={overview.users.banned} tone={overview.users.banned ? "text-critical" : ""} />
        </div>
      </section>
    </div>
  );
}
