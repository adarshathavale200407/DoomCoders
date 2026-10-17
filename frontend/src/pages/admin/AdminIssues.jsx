import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminApi } from "../../lib/adminApi.js";
import { useMeta } from "../../lib/useMeta.js";
import { CATEGORY_ICON, PRIORITY_CLS, STATUS_META, timeAgo } from "../../lib/format.js";
import { Empty, Pagination, errMsg, options, selectCls, useDebounced } from "../../components/admin/bits.jsx";
import { Alert, Button, Card, PageLoader } from "../../components/ui.jsx";

const STATUS_OPTS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));
// The API only accepts these as manual updates (reported/duplicate are set by the system).
const WORK_STATUSES = ["assigned", "in_progress", "resolved"];

export default function AdminIssues() {
  const meta = useMeta();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({
    search: "",
    status: params.get("status") || "",
    category: "",
    team: "",
    unassigned: params.get("unassigned") === "1",
    sort: "recent",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");

  const search = useDebounced(filters.search);
  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(() => {
    return adminApi
      .issues({ ...filters, search, unassigned: filters.unassigned || undefined, page, page_size: 20 })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(errMsg(e)));
  }, [filters, search, page]);

  useEffect(() => { load(); }, [load]);

  async function act(id, fn) {
    setBusyId(id);
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  }

  const teams = options(meta?.teams);
  const categories = options(meta?.categories);

  return (
    <div>
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          className={`${selectCls} lg:col-span-2`}
          placeholder="Search title, description, address, reporter"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
        <select className={selectCls} value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={selectCls} value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={selectCls} value={filters.team} onChange={(e) => set("team", e.target.value)}>
          <option value="">All teams</option>
          {teams.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={selectCls} value={filters.sort} onChange={(e) => set("sort", e.target.value)}>
          <option value="recent">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="upvotes">Most upvoted</option>
          <option value="priority">Highest priority</option>
        </select>
        <label className="flex items-center gap-2 text-sm lg:col-span-6">
          <input type="checkbox" checked={filters.unassigned} onChange={(e) => set("unassigned", e.target.checked)} />
          Only open reports with no team assigned
        </label>
      </Card>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <Card><Empty>No reports match these filters. Clear a filter to see more.</Empty></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Report</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Votes</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => {
                const pr = i.priority?.label || i.priority?.level;
                const busy = busyId === i.id;
                return (
                  <Fragment key={i.id}>
                    <tr className="border-b border-line/60 align-top last:border-0">
                      <td className="max-w-xs px-4 py-3">
                        <Link to={`/issues/${i.id}`} className="font-semibold hover:text-brand">
                          {CATEGORY_ICON[i.category] || "📍"} {i.title}
                        </Link>
                        <div className="mt-0.5 truncate text-xs text-muted">
                          {i.location?.address} · {timeAgo(i.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {pr && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_CLS[pr] || ""}`}>{pr}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {i.status === "duplicate" ? (
                          <span className="text-muted">Merged duplicate</span>
                        ) : (
                          <select className={selectCls} disabled={busy || !i.assigned_team} value={i.status}
                                  title={i.assigned_team ? "" : "Assign a team first"}
                                  onChange={(e) => act(i.id, () => adminApi.setStatus(i.id, e.target.value))}>
                            {!WORK_STATUSES.includes(i.status) && (
                              <option value={i.status} disabled>{STATUS_META[i.status]?.label || i.status}</option>
                            )}
                            {WORK_STATUSES.map((v) => <option key={v} value={v}>{STATUS_META[v].label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select className={selectCls} disabled={busy || i.status === "duplicate" || i.status === "resolved"} value={i.assigned_team || ""}
                                onChange={(e) => e.target.value && act(i.id, () => adminApi.assign(i.id, e.target.value))}>
                          <option value="">Unassigned</option>
                          {teams.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">{i.upvotes ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" className="px-3 py-1.5" onClick={() => { setNoteFor(noteFor === i.id ? null : i.id); setNoteText(""); }}>
                            Add note
                          </Button>
                          <Button variant="ghost" className="px-3 py-1.5 text-critical" disabled={busy}
                                  onClick={() => {
                                    if (window.confirm(`Delete "${i.title}"? This can't be undone.`))
                                      act(i.id, () => adminApi.deleteIssue(i.id));
                                  }}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {noteFor === i.id && (
                      <tr className="border-b border-line/60 bg-ink/[0.02]">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex gap-2">
                            <input className={`${selectCls} flex-1`} maxLength={500} autoFocus
                                   placeholder="Note shown on the report timeline (max 500 characters)"
                                   value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                            <Button loading={busy} disabled={!noteText.trim()}
                                    onClick={() => act(i.id, async () => { await adminApi.addNote(i.id, noteText.trim()); setNoteFor(null); })}>
                              Post note
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
    </div>
  );
}
