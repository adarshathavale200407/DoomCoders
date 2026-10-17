import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/Badges.jsx";
import IssueMap, { PRIORITY_COLORS } from "../components/IssueMap.jsx";
import { Alert, Button, Spinner } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON, formatDistance } from "../lib/format.js";
import { useMeta } from "../lib/useMeta.js";

const STATUS_PARAM = { open: "reported,assigned,in_progress", resolved: "resolved", all: "" };

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
        {children}
      </select>
    </label>
  );
}

export default function NearbyMap() {
  const meta = useMeta();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("open");
  const [radius, setRadius] = useState("5");
  const [user, setUser] = useState(null); // { lat, lng } once located
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // { id, n }

  const radiusKm = user && radius !== "all" ? Number(radius) : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get("/issues", {
        category,
        status: STATUS_PARAM[status],
        sort: user ? "nearest" : "priority",
        lat: user?.lat,
        lng: user?.lng,
        radius_km: radiusKm ?? (user ? 500 : undefined), // "all" = effectively unlimited
        limit: 500,
      })
      .then((data) => !cancelled && setItems(data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, status, user, radiusKm]);

  function toggleLocate() {
    if (user) return setUser(null);
    if (!navigator.geolocation) return setGeoError("Your browser doesn't support location.");
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Allow access in your browser and try again.");
      },
      { timeout: 10000 }
    );
  }

  const select = (id) => setSelected((s) => ({ id, n: (s?.n ?? 0) + 1 }));

  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0, Closed: 0 };
    items.forEach((i) => (c[i.priority.label] += 1));
    return c;
  }, [items]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Issue map</h1>
        <p className="mt-1 text-muted">See what's been reported around you. Pin color shows priority.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card p-4">
        <Select label="Category" value={category} onChange={setCategory}>
          <option value="">All categories</option>
          {meta?.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
        <Select label="Status" value={status} onChange={setStatus}>
          <option value="open">Open issues</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </Select>
        {user && (
          <Select label="Radius" value={radius} onChange={setRadius}>
            {[1, 3, 5, 10, 25].map((r) => <option key={r} value={r}>{r} km</option>)}
            <option value="all">Whole area</option>
          </Select>
        )}
        <Button variant={user ? "primary" : "ghost"} onClick={toggleLocate} loading={locating} className="ml-auto">
          {user ? "✓ Near me" : "📍 Near me"}
        </Button>
      </div>

      {geoError && <div className="mb-3"><Alert>{geoError}</Alert></div>}
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {Object.entries(PRIORITY_COLORS)
          .filter(([k]) => k !== "Closed" || status !== "open")
          .map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              {label} <span className="text-muted">({counts[label]})</span>
            </span>
          ))}
        {loading && <span className="ml-auto inline-flex items-center gap-1.5 text-brand"><Spinner className="h-4 w-4" /> Loading</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="isolate h-[60vh] overflow-hidden rounded-2xl border border-line lg:col-span-2 lg:h-[70vh]">
          <IssueMap items={items} user={user} radiusKm={radiusKm} selected={selected} onSelect={select} />
        </div>

        <aside className="max-h-96 overflow-y-auto rounded-2xl border border-line bg-card lg:h-[70vh] lg:max-h-none">
          <p className="sticky top-0 border-b border-line bg-card px-4 py-3 text-sm font-semibold">
            {items.length} report{items.length === 1 ? "" : "s"}
            {user ? " · nearest first" : " · highest priority first"}
          </p>

          {items.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-sm text-muted">
              Nothing to show here. Try a wider radius or different filters.{" "}
              <Link to="/report" className="font-semibold text-brand hover:underline">Report an issue</Link>
            </div>
          )}

          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id}>
                <button onClick={() => select(i.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition cursor-pointer
                          ${selected?.id === i.id ? "bg-brand/10" : "hover:bg-ink/5"}`}>
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: PRIORITY_COLORS[i.priority.label] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{CATEGORY_ICON[i.category]} {i.category_label}</span>
                      {i.distance_m != null && <span>{formatDistance(i.distance_m)}</span>}
                      <StatusBadge status={i.status} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
