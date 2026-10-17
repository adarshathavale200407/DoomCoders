import { useState } from "react";
import { api } from "../lib/api.js";
import { STATUS_META } from "../lib/format.js";
import { Alert, Button, Card } from "./ui.jsx";

const selectCls =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:opacity-60";
const WORK_STATUSES = ["assigned", "in_progress", "resolved"];

/**
 * Staff panel on the issue page: assign to a team (admin), update status (admin or
 * the assigned team), and merge into a suggested original (admin).
 * `related` = possible duplicates [{id,title,confidence}]; `onChange(updatedIssue)`;
 * `onMerged()` after a merge.
 */
export default function StaffActions({ issue, user, teams, related = [], onChange, onMerged }) {
  const isAdmin = user.role === "admin";
  const ownsIssue = user.role === "team" && user.team === issue.assigned_team;
  const closed = issue.status === "duplicate";

  const [team, setTeam] = useState(issue.assigned_team || issue.suggested_team || teams[0] || "");
  const [status, setStatus] = useState(issue.status === "assigned" ? "in_progress" : "resolved");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(kind, fn) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (closed || (!isAdmin && !ownsIssue)) return null;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-bold">Staff actions</h2>
      <div className="space-y-5">
        {isAdmin && issue.status !== "resolved" && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Assign to a team</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select className={selectCls} value={team} onChange={(e) => setTeam(e.target.value)}>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}{t === issue.suggested_team ? " (suggested)" : ""}
                  </option>
                ))}
              </select>
              <Button
                loading={busy === "assign"}
                disabled={!team || team === issue.assigned_team}
                onClick={() => run("assign", async () => onChange(await api.patch(`/issues/${issue.id}/assign`, { team })))}
              >
                {issue.assigned_team ? "Reassign" : "Assign"}
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-bold">Update status</h3>
          {!issue.assigned_team ? (
            <p className="text-sm text-muted">Assign a team first.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {WORK_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
                <Button
                  loading={busy === "status"}
                  onClick={() =>
                    run("status", async () => {
                      onChange(await api.patch(`/issues/${issue.id}/status`, { status, note: note.trim() || null }));
                      setNote("");
                    })
                  }
                >
                  Update
                </Button>
              </div>
              <input
                className={`${selectCls} w-full`}
                placeholder="Note for the citizen (optional)"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
        </div>

        {isAdmin && issue.status !== "resolved" && related.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Merge as duplicate of</h3>
            <ul className="space-y-2">
              {related
                .filter((r) => r.status !== "duplicate")
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{r.title}</span>
                    <Button
                      variant="ghost"
                      className="shrink-0 px-3 py-1.5"
                      loading={busy === `merge-${r.id}`}
                      onClick={() => {
                        if (!window.confirm(`Merge this report into "${r.title}"? This cannot be undone.`)) return;
                        run(`merge-${r.id}`, async () => {
                          await api.post(`/issues/${issue.id}/merge`, { duplicate_of: r.id });
                          onMerged();
                        });
                      }}
                    >
                      Merge
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {error && <Alert>{error}</Alert>}
      </div>
    </Card>
  );
}
