import { STATUS_META, formatDateTime } from "../lib/format.js";

const DOT = {
  reported: "bg-ink/40",
  assigned: "bg-sky-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  duplicate: "bg-ink/30",
};

/** entries = issue.timeline: [{ status, note, by, at }] in chronological order. Shows newest first. */
export default function Timeline({ entries }) {
  const list = [...(entries || [])].reverse();
  if (list.length === 0) return <p className="text-sm text-muted">No updates yet.</p>;

  return (
    <ol className="relative ml-2 border-l-2 border-line">
      {list.map((e, i) => (
        <li key={i} className="relative pb-6 pl-6 last:pb-0">
          <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-card ${DOT[e.status] || "bg-ink/40"}
                            ${i === 0 ? "ring-4 ring-brand/15" : ""}`} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{STATUS_META[e.status]?.label || e.status}</span>
            <span className="text-xs text-muted">{formatDateTime(e.at)}</span>
          </div>
          {e.note && <p className="mt-0.5 text-sm text-ink/80">{e.note}</p>}
          {e.by && <p className="text-xs text-muted">by {e.by}</p>}
        </li>
      ))}
    </ol>
  );
}
