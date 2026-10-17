import { formatDistance, timeAgo } from "../lib/format.js";
import { StatusBadge } from "./Badges.jsx";
import { Button } from "./ui.jsx";

/** Shown while filling the form: similar open reports found nearby. */
export default function DuplicateWarning({ matches, onSupport, supportingId, onDismiss }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h3 className="text-lg font-bold text-amber-900">Is this already reported?</h3>
      <p className="mt-1 text-sm text-amber-900/80">
        We found similar open reports nearby. Supporting an existing report raises its priority
        and avoids double work for the team.
      </p>

      <ul className="mt-4 space-y-3">
        {matches.map((m) => (
          <li key={m.id} className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={m.status} />
              <span className="text-xs font-semibold text-amber-800">{Math.round(m.confidence * 100)}% match</span>
              <span className="text-xs text-muted">
                {formatDistance(m.distance_m)} · {timeAgo(m.created_at)} · ▲ {m.upvotes}
              </span>
            </div>
            <p className="mt-1.5 font-semibold">{m.title}</p>
            <p className="line-clamp-2 text-sm text-muted">{m.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => onSupport(m)} loading={supportingId === m.id} className="!py-1.5">
                Same issue, support it
              </Button>
              <a href={`/issues/${m.id}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-ink/5">
                View report
              </a>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onDismiss}
              className="mt-4 text-sm font-semibold text-amber-900 underline cursor-pointer">
        None of these are my issue, continue reporting
      </button>
    </div>
  );
}
