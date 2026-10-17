import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "../components/Badges.jsx";
import PriorityBreakdown from "../components/PriorityBreakdown.jsx";
import StaffActions from "../components/StaffActions.jsx";
import StaticMap from "../components/StaticMap.jsx";
import Timeline from "../components/Timeline.jsx";
import { Alert, Card, PageLoader } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON, formatDateTime, formatHours, hoursSince, timeAgo } from "../lib/format.js";

const STEPS = [
  { key: "reported", label: "Reported" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

function StatusSteps({ status }) {
  const current = STEPS.findIndex((s) => s.key === status);
  if (current < 0) return null; // duplicates have no progress track
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= current ? "bg-brand" : "bg-line"}`} />
            )}
            <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-xs font-bold
                              ${done ? "bg-brand text-white" : "border-2 border-line bg-card text-muted"}`}>
              {done ? "✓" : i + 1}
            </span>
            <span className={`mt-1.5 text-xs ${i === current ? "font-semibold text-ink" : "text-muted"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Photo({ issue }) {
  const [broken, setBroken] = useState(false);
  if (!issue.photo_url || broken) return null;
  return (
    <img src={issue.photo_url} alt={issue.title} onError={() => setBroken(true)}
         className="max-h-[420px] w-full rounded-2xl border border-line object-cover" />
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [related, setRelated] = useState([]); // possible duplicates, with titles
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const isStaff = user && user.role !== "citizen";

  useEffect(() => {
    if (isStaff) api.get("/meta").then((m) => setTeams(m.teams)).catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    let cancelled = false;
    setIssue(null);
    setRelated([]);
    setError("");
    window.scrollTo(0, 0);

    api
      .get(`/issues/${id}`)
      .then(async (data) => {
        if (cancelled) return;
        setIssue(data);
        const ids = (data.possible_duplicates || []).map((d) => d.id);
        if (ids.length === 0) return;
        const results = await Promise.allSettled(ids.map((i) => api.get(`/issues/${i}`)));
        if (cancelled) return;
        const conf = Object.fromEntries(data.possible_duplicates.map((d) => [d.id, d.confidence]));
        setRelated(
          results
            .filter((r) => r.status === "fulfilled")
            .map((r) => ({ ...r.value, confidence: conf[r.value.id] }))
        );
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function upvote() {
    if (!user) return navigate("/login", { state: { from: `/issues/${id}` } });
    setBusy(true);
    setActionError("");
    try {
      setIssue(await api.post(`/issues/${id}/upvote`));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card className="mx-auto mt-6 max-w-lg text-center">
        <h1 className="text-2xl font-bold">Couldn't load this report</h1>
        <p className="mt-2 text-muted">{error}</p>
        <Link to="/issues" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
          Back to reports
        </Link>
      </Card>
    );
  }
  if (!issue) return <PageLoader />;

  const closed = issue.status === "resolved" || issue.status === "duplicate";
  const canUpvote = !issue.is_mine && !closed;
  const loc = issue.location;

  return (
    <div>
      <Link to="/issues" className="text-sm font-semibold text-brand hover:underline">← All reports</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
            <span className="text-sm text-muted">{CATEGORY_ICON[issue.category]} {issue.category_label}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{issue.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Reported by {issue.reporter_name || "a citizen"} · {timeAgo(issue.created_at)}
          </p>
        </div>

        <button
          onClick={upvote}
          disabled={!canUpvote || busy}
          title={issue.is_mine ? "You reported this" : closed ? "This issue is closed" : "I'm affected too"}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition
            ${issue.upvoted_by_me ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}
            disabled:cursor-not-allowed ${canUpvote ? "cursor-pointer" : "opacity-60"}`}
        >
          ▲ {issue.upvotes} <span>{issue.upvoted_by_me ? "Me too" : "Me too?"}</span>
        </button>
      </div>

      {actionError && <div className="mt-4"><Alert>{actionError}</Alert></div>}

      {issue.duplicate_of && (
        <div className="mt-5 rounded-xl border border-line bg-ink/5 px-4 py-3 text-sm">
          This report was merged into another report, and updates are tracked there.{" "}
          <Link to={`/issues/${issue.duplicate_of}`} className="font-semibold text-brand hover:underline">
            View the main report →
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ---------- main column ---------- */}
        <div className="space-y-6 lg:col-span-2">
          {issue.status !== "duplicate" && (
            <Card>
              <StatusSteps status={issue.status} />
              {issue.status === "resolved" && (
                <p className="mt-4 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                  Resolved in <strong>{formatHours(issue.resolution_hours)}</strong> on {formatDateTime(issue.resolved_at)}.
                </p>
              )}
            </Card>
          )}

          <Photo issue={issue} />

          <Card>
            <h2 className="mb-2 text-lg font-bold">What's wrong</h2>
            <p className="whitespace-pre-line text-ink/85">{issue.description}</p>
          </Card>

          {related.length > 0 && !issue.duplicate_of && (
            <Card className="border-amber-300 bg-amber-50">
              <h2 className="mb-1 text-lg font-bold text-amber-900">May overlap with other reports</h2>
              <p className="mb-3 text-sm text-amber-900/80">Flagged automatically by location and wording. The team reviews these.</p>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/issues/${r.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3.5 py-2.5 hover:border-amber-400">
                      <span className="min-w-0 truncate text-sm font-semibold">{r.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.confidence != null && (
                          <span className="text-xs font-semibold text-amber-800">{Math.round(r.confidence * 100)}%</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-lg font-bold">Progress updates</h2>
            <Timeline entries={issue.timeline} />
          </Card>

          {isStaff && (
            <StaffActions
              issue={issue}
              user={user}
              teams={teams.length ? teams : ["Roads", "Water", "Sanitation", "Electricity"]}
              related={related}
              onChange={(updated) => setIssue((prev) => ({ ...prev, ...updated }))}
              onMerged={reload}
            />
          )}
        </div>

        {/* ---------- side column ---------- */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold">Priority</h2>
            <PriorityBreakdown priority={issue.priority} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-bold">Details</h2>
            <dl className="divide-y divide-line">
              <Row label="Responsible team">
                {issue.assigned_team || (
                  <span className="text-muted">Awaiting assignment{issue.suggested_team ? ` (${issue.suggested_team})` : ""}</span>
                )}
              </Row>
              <Row label="Reported">{formatDateTime(issue.created_at)}</Row>
              <Row label={issue.status === "resolved" ? "Time to resolve" : "Open for"}>
                {issue.status === "resolved"
                  ? formatHours(issue.resolution_hours)
                  : issue.status === "duplicate"
                  ? "–"
                  : formatHours(hoursSince(issue.created_at))}
              </Row>
              <Row label="Last update">{timeAgo(issue.updated_at)}</Row>
              <Row label="Similar reports">{issue.duplicate_count}</Row>
              <Row label="Severity (reporter)">{issue.severity} / 5</Row>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">Location</h2>
            <StaticMap lat={loc.lat} lng={loc.lng} />
            {loc.address && <p className="mt-3 text-sm text-ink/80">📍 {loc.address}</p>}
            <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
               className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
              Open in Google Maps ↗
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
