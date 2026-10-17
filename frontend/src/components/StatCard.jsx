const TONES = {
  default: "text-ink",
  brand: "text-brand",
  accent: "text-accent",
  good: "text-low",
};

/** Small number card, reused on the dashboard and statistics pages. */
export default function StatCard({ label, value, hint, tone = "default" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
