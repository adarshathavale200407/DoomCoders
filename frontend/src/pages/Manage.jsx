import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "../components/Badges.jsx";
import { Alert, Button, Card, PageLoader } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON, STATUS_META, formatHours, hoursSince } from "../lib/format.js";

const selectCls =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:opacity-60";

const WORK_STATUSES = ["assigned", "in_progress", "resolved"];

/* ------------------------------------------------------------------ */
/* One issue row with its actions                                      */
/* ------------------------------------------------------------------ */
function IssueRow({ issue, isAdmin, teams, onUpdated, onMerged }) {
  const closed = issue.status === "resolved";
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(issue.assigned_team || issue.suggested_team || teams[0] || "");
  const [status, setStatus] = useState(issue.status === "assigned" ? "in_progress" : "resolved");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(kind, fn) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const assign = () =>
    run("assign", async () => {
      onUpdated(await api.patch(`/issues/${issue.id}/assign`, { team }));
    });

  const updateStatus = () =>
    run("status", async () => {
      onUpdated(await api.patch(`/issues/${issue.id}/status`, { status, note: note.trim() || null }));
      setNote("");
    });

  const merge = (match) => {
    if (!window.confirm(`Merge this report into "${match.title}"? This cannot be undone.`)) return;
    run(`merge-${match.id}`, async () => {
      await api.post(`/issues/${issue.id}/merge`, { duplicate_of: match.id });
      onMerged();
    });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
            <span className="text-sm text-muted">
              {CATEGORY_ICON[issue.category]} {issue.category_label}
            </span>
          </div>
          <Link to={`/issues/${issue.id}`} className="mt-1.5 block text-lg font-bold leading-snug hover:text-brand">
            {issue.title}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {issue.location?.address ? `📍 ${issue.location.address} · ` : ""}
            {closed ? `Fixed in ${formatHours(issue.resolution_hours)}` : `Open ${formatHours(hoursSince(issue.created_at))}`}
            {" · "}▲ {issue.upvotes}
            {issue.duplicate_count > 0 ? ` · ${issue.duplicate_count} similar` : ""}
            {issue.assigned_team ? ` · Team: ${issue.assigned_team}` : ""}
          </p>
        </div>
        {!closed && (
          <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen(!open)}>
            {open ? "Close" : "Manage"}
          </Button>
        )}
      </div>

      {/* Suggested duplicate matches are always visible to staff. */}
      {issue.suggested_matches?.length > 0 && !closed && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Possible duplicate of</p>
          <ul className="mt-2 space-y-2">
            {issue.suggested_matches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <Link to={`/issues/${m.id}`} className="block truncate text-sm font-semibold hover:text-brand">
                    {m.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {STATUS_META[m.status]?.label || m.status} · ▲ {m.upvotes} ·{" "}
                    <strong className="text-amber-800">{Math.round(m.confidence * 100)}% match</strong>
                  </span>
                </div>
                {isAdmin && (
                  <Button variant="ghost" className="px-3 py-1.5" loading={busy === `merge-${m.id}`} onClick={() => merge(m)}>
                    Merge into this
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && !closed && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          {/* assign: admin only */}
          <div>
            <h3 className="mb-2 text-sm font-bold">Assign to a team</h3>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <select className={selectCls} value={team} onChange={(e) => setTeam(e.target.value)}>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                      {t === issue.suggested_team ? " (suggested)" : ""}
                    </option>
                  ))}
                </select>
                <Button loading={busy === "assign"} onClick={assign} disabled={team === issue.assigned_team}>
                  {issue.assigned_team ? "Reassign" : "Assign"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">Only admins can assign teams.</p>
            )}
          </div>

          {/* status update */}
          <div>
            <h3 className="mb-2 text-sm font-bold">Update status</h3>
            {!issue.assigned_team ? (
              <p className="text-sm text-muted">Assign a team first.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {WORK_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                  <Button loading={busy === "status"} onClick={updateStatus}>Update</Button>
                </div>
                <input
                  className={`${selectCls} w-full`}
                  placeholder="Note for the citizen (optional), e.g. Crew dispatched"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <div className="md:col-span-2"><Alert>{error}</Alert></div>}
        </div>
      )}
      {!open && error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Manage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(isAdmin ? "queue" : "active");

  const load = useCallback(() => {
    return api
      .get("/issues/manage")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api.get("/meta").then((m) => setTeams(m.teams)).catch(() => {});
  }, [load]);

  const groups = useMemo(() => {
    const all = items || [];
    return {
      queue: all.filter((i) => i.status === "reported" && !i.assigned_team),
      active: all.filter((i) => i.status === "assigned" || i.status === "in_progress" || (i.status === "reported" && i.assigned_team)),
      resolved: all
        .filter((i) => i.status === "resolved")
        .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at)),
    };
  }, [items]);

  const tabs = [
    ...(isAdmin ? [{ key: "queue", label: "Unassigned queue" }] : []),
    { key: "active", label: "In progress" },
    { key: "resolved", label: "Resolved" },
  ];

  const replace = (updated) =>
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));

  if (error) return <Alert>{error}</Alert>;
  if (!items) return <PageLoader />;

  const list = groups[tab] || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Management console</h1>
        <p className="mt-1 text-muted">
          {isAdmin
            ? "Assign new reports to teams, track progress and merge duplicates. Highest priority first."
            : `Issues assigned to the ${user.team} team. Highest priority first.`}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
            }`}
          >
            {t.label} <span className="opacity-75">({groups[t.key].length})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-lg font-semibold">
            {tab === "queue" ? "Queue is clear 🎉" : "Nothing here"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tab === "queue" ? "Every report has been assigned to a team." : "No issues in this list right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              isAdmin={isAdmin}
              teams={teams.length ? teams : ["Roads", "Water", "Sanitation", "Electricity"]}
              onUpdated={replace}
              onMerged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
