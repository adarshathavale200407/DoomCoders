import { PriorityBadge } from "./Badges.jsx";

// Weights mirror backend scoring.py (0.40 / 0.35 / 0.25)
const FACTORS = [
  { key: "severity", label: "Severity", weight: 40, help: "Category risk and the severity the reporter chose" },
  { key: "impact", label: "Community impact", weight: 35, help: "Upvotes plus similar reports (maxes out at 10)" },
  { key: "age", label: "Time unresolved", weight: 25, help: "Grows daily, maxes out at 14 days" },
];

export default function PriorityBreakdown({ priority }) {
  if (!priority) return null;

  if (priority.label === "Closed") {
    return <p className="text-sm text-muted">This issue is closed, so it is no longer ranked.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <span className="font-display text-4xl font-bold leading-none">{Math.round(priority.score)}</span>
        <span className="pb-0.5 text-sm text-muted">/ 100</span>
        <span className="ml-auto"><PriorityBadge priority={{ ...priority, score: priority.score }} /></span>
      </div>

      <div className="space-y-3.5">
        {FACTORS.map((f) => {
          const v = priority.breakdown[f.key] ?? 0;
          return (
            <div key={f.key} title={f.help}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">{f.label} <span className="font-normal text-muted">· {f.weight}%</span></span>
                <span className="text-muted">{Math.round(v * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(v * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
