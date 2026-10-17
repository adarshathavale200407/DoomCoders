import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "../components/Badges.jsx";
import StatCard from "../components/StatCard.jsx";
import { Alert, Button, PageLoader } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON, STATUS_META, formatHours, timeAgo, toDate } from "../lib/format.js";

const OPEN = ["reported", "assigned", "in_progress"];
const STEPS = ["reported", "assigned", "in_progress", "resolved"];
const seenKey = (uid) => `civicfix_seen_${uid}`;

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
];

// The initial "Reported" entry doesn't count as an update
function latestUpdate(issue) {
  const tl = issue.timeline || [];
  return tl.length > 1 ? tl[tl.length - 1] : null;
}

function ProgressBar({ status }) {
  const idx = STEPS.indexOf(status);
  if (idx < 0) return null;
  return (
    <div className="flex gap-1" aria-label={`Progress: ${STATUS_META[status].label}`}>
      {STEPS.map((s, i) => (
        <span key={s} title={STATUS_META[s].label}
              className={`h-1.5 flex-1 rounded-full ${i <= idx ? (status === "resolved" ? "bg-low" : "bg-brand") : "bg-ink/10"}`} />
      ))}
    </div>
  );
}

function MyIssue({ issue, isNew }) {
  const update = latestUpdate(issue);
  return (
    <Link to={`/issues/${issue.id}`}
          className="block rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-paper text-2xl">
          {CATEGORY_ICON[issue.category] || "📍"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            {isNew && (
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">New update</span>
            )}
            <span className="ml-auto text-xs text-muted">Reported {timeAgo(issue.created_at)}</span>
          </div>

          <h3 className="mt-1.5 font-display text-lg font-bold leading-snug">{issue.title}</h3>

          <div className="mt-3">
            {issue.status === "duplicate" ? (
              <p className="text-sm text-muted">Merged into another report. Follow it there for updates.</p>
            ) : (
              <ProgressBar status={issue.status} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {update ? (
              <span className="text-ink/80">
                <strong>{STATUS_META[update.status]?.label}</strong>
                {update.note ? `: ${update.note}` : ""} · {timeAgo(update.at)}
              </span>
            ) : (
              <span>Waiting for a team to pick this up</span>
            )}
            <span className="ml-auto flex gap-3">
              {issue.assigned_team && <span>Team: {issue.assigned_team}</span>}
              <span>▲ {issue.upvotes}</span>
              {issue.status === "resolved" && <span>Fixed in {formatHours(issue.resolution_hours)}</span>}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const prevSeen = useRef(null); // when the citizen last opened this page

  useEffect(() => {
    let cancelled = false;
    try {
      const v = localStorage.getItem(seenKey(user.id));
      prevSeen.current = v ? Number(v) : null;
    } catch {
      prevSeen.current = null;
    }
    api
      .get("/issues/mine")
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        try {
          localStorage.setItem(seenKey(user.id), String(Date.now()));
        } catch {
          /* private mode: skip */
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const isNew = (issue) => {
    const u = latestUpdate(issue);
    return prevSeen.current != null && u && toDate(u.at).getTime() > prevSeen.current;
  };

  const stats = useMemo(() => {
    if (!items) return null;
    const resolved = items.filter((i) => i.status === "resolved");
    const hours = resolved.map((i) => i.resolution_hours).filter((h) => h != null);
    return {
      total: items.length,
      open: items.filter((i) => OPEN.includes(i.status)).length,
      resolved: resolved.length,
      avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
      supporters: items.reduce((sum, i) => sum + (i.upvotes || 0), 0),
    };
  }, [items]);

  const shown = useMemo(() => {
    if (!items) return [];
    if (tab === "open") return items.filter((i) => OPEN.includes(i.status));
    if (tab === "resolved") return items.filter((i) => i.status === "resolved");
    return items;
  }, [items, tab]);

  const newCount = items ? items.filter(isNew).length : 0;
  const counts = { all: items?.length ?? 0, open: stats?.open ?? 0, resolved: stats?.resolved ?? 0 };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hi, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-muted">Here's what's happening with the issues you reported.</p>
        </div>
        <Button variant="accent" onClick={() => navigate("/report")}>+ Report issue</Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <PageLoader />}

      {items && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Reports filed" value={stats.total} hint={`${stats.supporters} supporters in total`} />
            <StatCard label="Still open" value={stats.open} tone="accent" hint="Waiting or in progress" />
            <StatCard label="Resolved" value={stats.resolved} tone="good" hint="Fixed by the teams" />
            <StatCard label="Avg. time to fix" value={stats.avgHours == null ? "–" : formatHours(stats.avgHours)}
                      tone="brand" hint="On your resolved reports" />
          </div>

          {newCount > 0 && (
            <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
              <strong>{newCount}</strong> of your reports {newCount > 1 ? "have" : "has"} new updates since your last visit.
            </div>
          )}

          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-line py-16 text-center">
              <p className="text-lg font-semibold">You haven't reported anything yet</p>
              <p className="mt-1 text-sm text-muted">See a pothole, leak or broken light? It takes a minute.</p>
              <Link to="/report" className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Report your first issue
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-8 mb-4 flex gap-1 border-b border-line">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition cursor-pointer
                            ${tab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>
                    {t.label} <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">Nothing here yet.</p>
              ) : (
                <div className="space-y-3">
                  {shown.map((i) => <MyIssue key={i.id} issue={i} isNew={isNew(i)} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
