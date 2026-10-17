// Backend timestamps may come without a timezone suffix; treat those as UTC.
export const toDate = (iso) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - toDate(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${name}${n > 1 ? "s" : ""} ago`;
    }
  }
}

export function formatDateTime(iso) {
  if (!iso) return "";
  return toDate(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function hoursSince(iso) {
  return Math.max(0, Math.round(((Date.now() - toDate(iso).getTime()) / 36e5) * 10) / 10);
}

export function formatDistance(m) {
  if (m == null) return "";
  return m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`;
}

export function formatHours(h) {
  if (h == null) return "–";
  if (h < 1) return "under 1 hr";
  if (h < 48) return `${Math.round(h)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

export const CATEGORY_ICON = {
  pothole: "🕳️",
  water_leak: "💧",
  garbage: "🗑️",
  streetlight: "💡",
  other: "📍",
};

export const STATUS_META = {
  reported: { label: "Reported", cls: "bg-ink/8 text-ink/70" },
  assigned: { label: "Assigned", cls: "bg-sky-100 text-sky-800" },
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-800" },
  resolved: { label: "Resolved", cls: "bg-emerald-100 text-emerald-800" },
  duplicate: { label: "Duplicate", cls: "bg-ink/8 text-muted" },
};

export const PRIORITY_CLS = {
  Critical: "bg-critical/10 text-critical",
  High: "bg-high/10 text-high",
  Medium: "bg-medium/15 text-amber-700",
  Low: "bg-low/15 text-low",
  Closed: "bg-ink/8 text-muted",
};
