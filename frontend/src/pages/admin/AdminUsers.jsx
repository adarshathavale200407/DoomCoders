import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../../lib/adminApi.js";
import { useMeta } from "../../lib/useMeta.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatDateTime } from "../../lib/format.js";
import { Empty, Pagination, errMsg, options, selectCls, useDebounced } from "../../components/admin/bits.jsx";
import { Alert, Button, Card, PageLoader } from "../../components/ui.jsx";

function RoleEditor({ user, teams, busy, onSave, onCancel }) {
  const [role, setRole] = useState(user.role);
  const [team, setTeam] = useState(user.team || teams[0]?.value || "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="citizen">Citizen</option>
        <option value="team">Team member</option>
        <option value="admin">Admin</option>
      </select>
      {role === "team" && (
        <select className={selectCls} value={team} onChange={(e) => setTeam(e.target.value)}>
          {teams.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <Button className="px-3 py-1.5" loading={busy} onClick={() => onSave(role, role === "team" ? team : null)}>Save role</Button>
      <Button variant="ghost" className="px-3 py-1.5" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

export default function AdminUsers() {
  const meta = useMeta();
  const { user: me } = useAuth();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") || "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const search = useDebounced(q);
  const teams = options(meta?.teams);

  const load = useCallback(
    () => adminApi.users({ role, search, page, page_size: 20 })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(errMsg(e))),
    [role, search, page]
  );
  useEffect(() => { load(); }, [load]);

  async function act(id, fn) {
    setBusyId(id);
    setError("");
    try { await fn(); setEditing(null); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  }

  return (
    <div>
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <input className={`${selectCls} sm:col-span-2`} placeholder="Search by name or email"
               value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={selectCls} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="citizen">Citizens</option>
          <option value="team">Team members</option>
          <option value="admin">Admins</option>
        </select>
      </Card>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <Card><Empty>No users match these filters.</Empty></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => {
                const self = u.id === me?.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="border-b border-line/60 align-top last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        {u.name} {self && <span className="text-xs font-normal text-muted">(you)</span>}
                        {u.banned && <span className="ml-2 rounded-full bg-critical/10 px-2 py-0.5 text-xs font-semibold text-critical">Banned</span>}
                      </div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {editing === u.id ? (
                        <RoleEditor user={u} teams={teams} busy={busy}
                                    onSave={(r, t) => act(u.id, () => adminApi.setRole(u.id, r, t))}
                                    onCancel={() => setEditing(null)} />
                      ) : (
                        <>{u.role}{u.team ? ` · ${u.team}` : ""}</>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" className="px-3 py-1.5" disabled={self || busy} onClick={() => setEditing(u.id)}>
                          Change role
                        </Button>
                        <Button variant="ghost" className={`px-3 py-1.5 ${u.banned ? "" : "text-critical"}`}
                                disabled={self || busy}
                                onClick={() => {
                                  if (u.banned || window.confirm(`Ban ${u.name}? They won't be able to use the app.`))
                                    act(u.id, () => adminApi.setBan(u.id, !u.banned));
                                }}>
                          {u.banned ? "Unban" : "Ban"}
                        </Button>
                      </div>
                    </td>
                  </tr>
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
