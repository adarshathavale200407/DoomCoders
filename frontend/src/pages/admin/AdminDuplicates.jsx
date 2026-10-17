import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../lib/adminApi.js";
import { STATUS_META, timeAgo } from "../../lib/format.js";
import { Empty, errMsg } from "../../components/admin/bits.jsx";
import { Alert, Button, Card, PageLoader } from "../../components/ui.jsx";

const pct = (c) => Math.round(c <= 1 ? c * 100 : c);

export default function AdminDuplicates() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () => adminApi.duplicates().then(setItems).catch((e) => setError(errMsg(e))),
    []
  );
  useEffect(() => { load(); }, [load]);

  async function act(id, fn) {
    setBusyId(id);
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  }

  if (!items) return error ? <Alert>{error}</Alert> : <PageLoader />;

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {items.length === 0 && <Card><Empty>No duplicate suggestions to review.</Empty></Card>}

      {items.map((i) => (
        <Card key={i.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted">New report · {timeAgo(i.created_at)}</div>
              <Link to={`/issues/${i.id}`} className="font-semibold hover:text-brand">{i.title}</Link>
              <p className="mt-1 max-w-prose text-sm text-ink/75">{i.description}</p>
              <div className="mt-1 text-xs text-muted">{i.location?.address}</div>
            </div>
            <Button variant="ghost" loading={busyId === i.id}
                    onClick={() => act(i.id, () => adminApi.dismissDuplicate(i.id))}>
              Not a duplicate
            </Button>
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <div className="text-sm font-medium">Possible matches</div>
            {i.suggested_matches.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div className="min-w-0">
                  <Link to={`/issues/${m.id}`} className="text-sm font-semibold hover:text-brand">{m.title}</Link>
                  <div className="text-xs text-muted">
                    {pct(m.confidence)}% match · {STATUS_META[m.status]?.label || m.status} · {m.upvotes} votes
                  </div>
                </div>
                <Button loading={busyId === i.id}
                        onClick={() => {
                          if (window.confirm("Merge this report into the matching one?"))
                            act(i.id, () => adminApi.merge(i.id, m.id));
                        }}>
                  Merge into this
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
