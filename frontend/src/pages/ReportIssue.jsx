import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PriorityBadge } from "../components/Badges.jsx";
import DuplicateWarning from "../components/DuplicateWarning.jsx";
import MapPicker from "../components/MapPicker.jsx";
import { Alert, Button, Card, Field, Spinner } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON } from "../lib/format.js";
import { uploadConfigured, uploadPhoto } from "../lib/upload.js";
import { useMeta } from "../lib/useMeta.js";

const SEVERITY = [
  { v: 1, label: "Minor", hint: "Cosmetic, no real risk" },
  { v: 2, label: "Low", hint: "Inconvenient" },
  { v: 3, label: "Moderate", hint: "Affects daily use" },
  { v: 4, label: "Serious", hint: "Risk of harm or damage" },
  { v: 5, label: "Dangerous", hint: "Immediate danger" },
];

export default function ReportIssue() {
  const meta = useMeta();

  const [form, setForm] = useState({ title: "", description: "", category: "", severity: 3 });
  const [position, setPosition] = useState(null);
  const [focus, setFocus] = useState(null);
  const [address, setAddress] = useState("");
  const addressEdited = useRef(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const [photo, setPhoto] = useState({ url: "", preview: "", uploading: false });
  const [photoError, setPhotoError] = useState("");

  const [dupes, setDupes] = useState([]);
  const [dismissedKey, setDismissedKey] = useState("");
  const [supportingId, setSupportingId] = useState(null);
  const [supported, setSupported] = useState(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ---------- location ----------
  function locate(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) setGeoError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setFocus({ ...p, zoom: 17 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (!silent) setGeoError("Couldn't get your location. Allow access, or tap the map to place the pin.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // Try once on page open; stay quiet if the user says no
  useEffect(() => {
    locate(true);
  }, []);

  // Fill the address from the pin (best effort, OpenStreetMap Nominatim)
  useEffect(() => {
    if (!position) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${position.lat}&lon=${position.lng}`,
          { signal: ctrl.signal }
        );
        const d = await r.json();
        if (d.display_name && !addressEdited.current) setAddress(d.display_name.slice(0, 300));
      } catch {
        /* address stays as is */
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [position]);

  async function searchPlace(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setGeoError("");
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(search)}`
      );
      const [hit] = await r.json();
      if (!hit) return setGeoError("No place found. Try a more specific search.");
      const p = { lat: Number(hit.lat), lng: Number(hit.lon) };
      setPosition(p);
      setFocus({ ...p, zoom: 17 });
    } catch {
      setGeoError("Search failed. Tap the map to place the pin instead.");
    } finally {
      setSearching(false);
    }
  }

  // ---------- photo ----------
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setPhotoError("Image must be under 8 MB.");
    setPhotoError("");
    setPhoto({ url: "", preview: URL.createObjectURL(file), uploading: true });
    try {
      const url = await uploadPhoto(file);
      setPhoto((p) => ({ ...p, url, uploading: false }));
    } catch (err) {
      setPhoto({ url: "", preview: "", uploading: false });
      setPhotoError(err.message);
    }
  }

  // ---------- live duplicate check ----------
  useEffect(() => {
    if (!form.category || !position) {
      setDupes([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .post("/issues/check-duplicates", {
          category: form.category,
          lat: position.lat,
          lng: position.lng,
          title: form.title,
          description: form.description,
        })
        .then((r) => !cancelled && setDupes(r))
        .catch(() => {});
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.category, form.title, form.description, position]);

  const dupKey = dupes.map((d) => d.id).join(",");
  const showDupes = dupes.length > 0 && dupKey !== dismissedKey;

  // The upvote endpoint toggles, so check first to avoid removing an existing vote
  async function support(match) {
    setSupportingId(match.id);
    setError("");
    try {
      const current = await api.get(`/issues/${match.id}`);
      if (!current.upvoted_by_me) await api.post(`/issues/${match.id}/upvote`);
      setSupported(match);
    } catch (err) {
      setError(err.message);
    } finally {
      setSupportingId(null);
    }
  }

  // ---------- submit ----------
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.category) return setError("Choose a category.");
    if (!position) return setError("Pin the location on the map.");
    if (photo.uploading) return setError("Wait for the photo to finish uploading.");

    setBusy(true);
    try {
      const issue = await api.post("/issues", {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        severity: Number(form.severity),
        photo_url: photo.url.trim() || null,
        lat: position.lat,
        lng: position.lng,
        address: address.trim() || null,
      });
      setCreated(issue);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- done states ----------
  if (supported) {
    return (
      <Card className="mx-auto mt-6 max-w-lg text-center">
        <div className="text-4xl">🙌</div>
        <h1 className="mt-2 text-2xl font-bold">Thanks, support added</h1>
        <p className="mt-2 text-muted">
          You backed "<span className="font-semibold text-ink">{supported.title}</span>". More support moves it up the queue.
        </p>
        <Link to="/issues" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
          Back to reports
        </Link>
      </Card>
    );
  }

  if (created) {
    return (
      <Card className="mx-auto mt-6 max-w-lg text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-2 text-2xl font-bold">Report submitted</h1>
        <p className="mt-2 text-muted">"{created.title}" is now visible to the community.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <PriorityBadge priority={created.priority} />
          {created.suggested_team && <span className="text-muted">Will be routed to the {created.suggested_team} team</span>}
        </div>
        {created.possible_duplicate_of && (
          <p className="mt-3 text-sm text-amber-800">
            This may overlap with an existing report. The team will review it.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/issues" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
            View all reports
          </Link>
          <button onClick={() => window.location.reload()}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-ink/5 cursor-pointer">
            Report another
          </button>
        </div>
      </Card>
    );
  }

  const selectedCat = meta?.categories.find((c) => c.key === form.category);

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">Report an issue</h1>
      <p className="mt-1 mb-6 text-muted">Tell us what's wrong and where. It takes about a minute.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- left: details ---------- */}
        <div className="space-y-5">
          <Card className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-medium">Category</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {!meta && <Spinner className="h-5 w-5 text-brand" />}
                {meta?.categories.map((c) => (
                  <button key={c.key} type="button" onClick={() => setForm((f) => ({ ...f, category: c.key }))}
                          className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition cursor-pointer
                            ${form.category === c.key ? "border-brand bg-brand/10 text-brand" : "border-line bg-white hover:border-brand/50"}`}>
                    <span className="mr-1.5">{CATEGORY_ICON[c.key] || "📍"}</span>{c.label}
                  </button>
                ))}
              </div>
              {selectedCat?.team && (
                <p className="mt-2 text-xs text-muted">This will be routed to the {selectedCat.team} team.</p>
              )}
            </div>

            <Field label="Title" value={form.title} onChange={setField("title")} required minLength={3} maxLength={120}
                   placeholder="e.g. Deep pothole near the bus stop" />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Description</span>
              <textarea value={form.description} onChange={setField("description")} required minLength={5} maxLength={2000} rows={4}
                        placeholder="What did you see? Since when? Is it blocking traffic or unsafe?"
                        className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none" />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium">How severe is it?</span>
              <div className="grid grid-cols-5 gap-1.5">
                {SEVERITY.map((s) => (
                  <button key={s.v} type="button" title={s.hint} onClick={() => setForm((f) => ({ ...f, severity: s.v }))}
                          className={`rounded-lg border py-2 text-xs font-semibold transition cursor-pointer
                            ${form.severity === s.v ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/50"}`}>
                    {s.v}<span className="block font-normal opacity-80">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{SEVERITY[form.severity - 1].hint}</p>
            </div>
          </Card>

          <Card>
            <span className="mb-2 block text-sm font-medium">Photo <span className="font-normal text-muted">(optional)</span></span>
            {uploadConfigured ? (
              photo.preview ? (
                <div className="relative w-fit">
                  <img src={photo.preview} alt="Selected" className="h-40 rounded-xl object-cover" />
                  {photo.uploading && (
                    <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/70 text-brand"><Spinner /></div>
                  )}
                  {!photo.uploading && (
                    <button type="button" onClick={() => setPhoto({ url: "", preview: "", uploading: false })}
                            className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer">
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center hover:border-brand/60">
                  <span className="text-2xl">📷</span>
                  <span className="text-sm font-semibold">Take or choose a photo</span>
                  <span className="text-xs text-muted">JPG or PNG, up to 8 MB</span>
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
                </label>
              )
            ) : (
              <Field label="" type="url" placeholder="Paste a photo link (https://...)" maxLength={1000}
                     value={photo.url} onChange={(e) => setPhoto((p) => ({ ...p, url: e.target.value }))} />
            )}
            {photoError && <p className="mt-2 text-xs text-critical">{photoError}</p>}
          </Card>
        </div>

        {/* ---------- right: location ---------- */}
        <Card className="space-y-4 self-start">
          <span className="block text-sm font-medium">Location</span>

          <div className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a street or landmark"
                   onKeyDown={(e) => e.key === "Enter" && searchPlace(e)}
                   className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none" />
            <Button type="button" variant="ghost" onClick={searchPlace} loading={searching}>Search</Button>
          </div>

          <MapPicker position={position} focus={focus} onChange={setPosition} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {position ? "Drag the pin or tap the map to adjust." : "Tap the map to drop a pin."}
            </p>
            <Button type="button" variant="ghost" onClick={() => locate(false)} loading={locating} className="!py-1.5">
              📍 Use my location
            </Button>
          </div>
          {geoError && <Alert>{geoError}</Alert>}

          <Field label="Address / landmark" value={address} maxLength={300} placeholder="Filled in from the pin, edit if needed"
                 onChange={(e) => { addressEdited.current = true; setAddress(e.target.value); }} />
        </Card>
      </div>

      {/* ---------- duplicates + submit ---------- */}
      <div className="mt-6 space-y-4">
        {showDupes && (
          <DuplicateWarning matches={dupes} onSupport={support} supportingId={supportingId}
                            onDismiss={() => setDismissedKey(dupKey)} />
        )}
        <Alert>{error}</Alert>
        <Button type="submit" variant="accent" loading={busy} disabled={photo.uploading} className="w-full !py-3 text-base sm:w-auto sm:px-10">
          Submit report
        </Button>
      </div>
    </form>
  );
}
