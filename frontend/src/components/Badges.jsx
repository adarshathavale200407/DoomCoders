import { PRIORITY_CLS, STATUS_META } from "../lib/format.js";

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: "bg-ink/8 text-ink/70" };
  return <span className={`${base} ${m.cls}`}>{m.label}</span>;
}

/** priority = { score, label, breakdown: { severity, impact, age } } from the API */
export function PriorityBadge({ priority }) {
  if (!priority) return null;
  const b = priority.breakdown;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const tip =
    priority.label === "Closed"
      ? "Closed issues are not prioritised"
      : `Severity ${pct(b.severity)} · Community impact ${pct(b.impact)} · Time unresolved ${pct(b.age)}`;
  return (
    <span className={`${base} ${PRIORITY_CLS[priority.label]}`} title={tip}>
      {priority.label}
      {priority.label !== "Closed" && <span className="ml-1 opacity-70">{Math.round(priority.score)}</span>}
    </span>
  );
}
