import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../lib/adminApi.js";
import { STATUS_META } from "../../lib/format.js";
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
      ...STATUSES.map((s) => adminApi.issues({ status: s, page_size: 1 })),
    ])
      .then(([overview, ...pages]) => {
        if (off) return;
        setData({ overview, counts: Object.fromEntries(STATUSES.map((s, i) => [s, pages[i].total])) });
      })
      .catch((e) => !off && setError(errMsg(e)));
    return () => { off = true; };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;
  const { overview, counts } = data;

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
