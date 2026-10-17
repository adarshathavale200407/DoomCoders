import { useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_ICON, formatDistance, timeAgo } from "../lib/format.js";
import { PriorityBadge, StatusBadge } from "./Badges.jsx";

function Thumb({ issue }) {
  const [broken, setBroken] = useState(false);
  if (issue.photo_url && !broken) {
    return (
      <img src={issue.photo_url} alt="" loading="lazy" onError={() => setBroken(true)}
           className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28" />
    );
  }
  return (
    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-paper text-3xl sm:h-28 sm:w-28">
      {CATEGORY_ICON[issue.category] || "📍"}
    </div>
  );
}

export default function IssueCard({ issue, onUpvote, busy }) {
  const closed = issue.status === "resolved" || issue.status === "duplicate";
  const canUpvote = !issue.is_mine && !closed;

  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:shadow-md">
      <Thumb issue={issue} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
          <span className="text-xs text-muted">{issue.category_label}</span>
        </div>

        <Link to={`/issues/${issue.id}`} className="font-display text-lg font-bold leading-snug hover:text-brand">
          {issue.title}
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{issue.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-xs text-muted">
          <span className="truncate">📍 {issue.location?.address || "Pinned location"}</span>
          {issue.distance_m != null && <span>{formatDistance(issue.distance_m)}</span>}
          <span>{timeAgo(issue.created_at)}</span>
          {issue.assigned_team && <span>Team: {issue.assigned_team}</span>}
          {issue.duplicate_count > 0 && <span>{issue.duplicate_count} similar report{issue.duplicate_count > 1 ? "s" : ""}</span>}

          <button
            onClick={() => onUpvote(issue)}
            disabled={!canUpvote || busy}
            title={issue.is_mine ? "You reported this" : closed ? "This issue is closed" : "I'm affected too"}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition
              ${issue.upvoted_by_me ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand"}
              disabled:cursor-not-allowed ${!canUpvote ? "opacity-60" : "cursor-pointer"}`}
          >
            ▲ {issue.upvotes}
            <span className="hidden sm:inline">{issue.upvoted_by_me ? "Me too" : "Me too?"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
