import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, PageLoader } from "../components/ui.jsx";
import IssueCard from "../components/IssueCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { useMeta } from "../lib/useMeta.js";

const STATUS_OPTIONS = [
  { value: "open", label: "Open issues" },
  { value: "all", label: "All (incl. resolved)" },
  { value: "reported", label: "Reported" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

const SORT_OPTIONS = [
  { value: "priority", label: "Highest priority" },
  { value: "recent", label: "Most recent" },
  { value: "upvotes", label: "Most supported" },
];

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

export default function Issues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const meta = useMeta();

  const [filters, setFilters] = useState({ category: "", status: "open", sort: "priority", radius: "5" });
  const [coords, setCoords] = useState(null); // { lat, lng } when "Near me" is on
  const [geoState, setGeoState] = useState("idle"); // idle | loading | error
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  // Fetch whenever filters or location change
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError("");
    api
      .get("/issues", {
        category: filters.category,
        status: filters.status === "open" ? "reported,assigned,in_progress" : filters.status === "all" ? "" : filters.status,
        sort: filters.sort,
        lat: coords?.lat,
        lng: coords?.lng,
        radius_km: coords ? filters.radius : undefined,
      })
      .then((data) => !cancelled && setItems(data))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [filters, coords]);

  function toggleNearMe() {
    if (coords) {
      setCoords(null);
      if (filters.sort === "nearest") set("sort")("priority");
      return;
    }
    if (!navigator.geolocation) return setGeoState("error");
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
        set("sort")("nearest");
      },
      () => setGeoState("error"),
      { timeout: 10000 }
    );
  }

  const upvote = useCallback(
    async (issue) => {
      if (!user) return navigate("/login", { state: { from: "/issues" } });
      setBusyId(issue.id);
      setError("");
      try {
        const updated = await api.post(`/issues/${issue.id}/upvote`);
        // Keep distance, which the single-issue endpoint doesn't return
        setItems((list) =>
          list.map((i) => (i.id === issue.id ? { ...updated, distance_m: i.distance_m } : i))
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setBusyId(null);
      }
    },
    [user, navigate]
  );

  const sortOptions = coords ? [...SORT_OPTIONS, { value: "nearest", label: "Nearest first" }] : SORT_OPTIONS;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Community reports</h1>
          <p className="mt-1 text-muted">Ranked by severity, community impact and how long they've waited.</p>
        </div>
        {user?.role === "citizen" && (
          <Button variant="accent" onClick={() => navigate("/report")}>+ Report issue</Button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card p-4">
        <Select label="Category" value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {meta?.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
        <Select label="Status" value={filters.status} onChange={set("status")}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select label="Sort by" value={filters.sort} onChange={set("sort")}>
          {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        {coords && (
          <Select label="Radius" value={filters.radius} onChange={set("radius")}>
            {[1, 3, 5, 10, 25].map((r) => <option key={r} value={r}>{r} km</option>)}
          </Select>
        )}
        <Button variant={coords ? "primary" : "ghost"} onClick={toggleNearMe} loading={geoState === "loading"} className="ml-auto">
          {coords ? "✓ Near me" : "📍 Near me"}
        </Button>
      </div>

      {geoState === "error" && (
        <div className="mb-4"><Alert>Couldn't get your location. Allow location access in your browser and try again.</Alert></div>
      )}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!items && !error && <PageLoader />}

      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-lg font-semibold">No reports match these filters</p>
          <p className="mt-1 text-sm text-muted">
            {coords ? "Try a larger radius, or " : "Try changing the filters, or "}
            <Link to={user ? "/report" : "/register"} className="font-semibold text-brand hover:underline">
              report a new issue
            </Link>.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted">{items.length} report{items.length > 1 ? "s" : ""}</p>
          <div className="space-y-3">
            {items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onUpvote={upvote} busy={busyId === issue.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
