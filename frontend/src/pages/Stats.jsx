import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "../components/StatCard.jsx";
import { Alert, Card, PageLoader } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { CATEGORY_ICON, STATUS_META, formatHours } from "../lib/format.js";

const PRIORITY_COLORS = { Critical: "#c62828", High: "#e4572e", Medium: "#d99a00", Low: "#4f8f6f" };
const STATUS_COLORS = {
  reported: "#9ca3af",
  assigned: "#0ea5e9",
  in_progress: "#f59e0b",
  resolved: "#10b981",
  duplicate: "#cbd5e1",
};
const TEAM_ICON = { Roads: "🛣️", Water: "💧", Sanitation: "🧹", Electricity: "⚡" };

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Section({ title, subtitle, children, className }) {
  return (
    <Card className={className}>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-sm text-muted">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </Card>
  );
}

function RateBar({ value, total }) {
  const pct = total ? Math.round((100 * value) / total) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full bg-low" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-xs text-muted">{pct}%</span>
    </div>
  );
}

export default function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/stats")
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const daily = useMemo(
    () => (data ? data.last_14_days.map((d) => ({ ...d, label: shortDate(d.date) })) : []),
    [data]
  );
  const priorityData = useMemo(
    () => (data ? Object.entries(data.open_by_priority).map(([name, value]) => ({ name, value })) : []),
    [data]
  );
  const statusTotal = data ? Object.values(data.by_status).reduce((a, b) => a + b, 0) : 0;

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;

  const openTotal = priorityData.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">City statistics</h1>
        <p className="mt-1 text-muted">How many issues are reported, how fast they get fixed, and where the backlog is.</p>
      </div>

      {data.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-lg font-semibold">No data yet</p>
          <p className="mt-1 text-sm text-muted">Statistics will appear once citizens start reporting issues.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---------- headline numbers ---------- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Total reports" value={data.total} hint="Excluding merged duplicates" />
            <StatCard label="Open now" value={data.open} tone="accent" hint={`${data.unassigned} awaiting a team`} />
            <StatCard label="Resolved" value={data.resolved} tone="good" hint={`${data.resolution_rate}% resolution rate`} />
            <StatCard label="Avg. time to fix" value={formatHours(data.avg_resolution_hours)} tone="brand"
                      hint={data.median_resolution_hours != null ? `Median ${formatHours(data.median_resolution_hours)}` : "No resolved issues yet"} />
            <StatCard label="Duplicates merged" value={data.duplicates_merged} hint="Reports folded into others" />
          </div>

          {/* ---------- trend + priority ---------- */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Last 14 days" subtitle="New reports vs. issues resolved each day" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={daily} margin={{ top: 5, right: 8, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3ddd0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e3ddd0" }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="reported" name="Reported" fill="#e4572e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#1f6f5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Open issues by priority" subtitle="From the automatic priority score">
              {openTotal === 0 ? (
                <p className="py-16 text-center text-sm text-muted">No open issues. 🎉</p>
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={priorityData.filter((p) => p.value > 0)} dataKey="value" nameKey="name"
                             innerRadius={58} outerRadius={85} paddingAngle={2} stroke="none">
                          {priorityData.filter((p) => p.value > 0).map((p) => (
                            <Cell key={p.name} fill={PRIORITY_COLORS[p.name]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <div className="font-display text-3xl font-bold">{openTotal}</div>
                        <div className="text-xs text-muted">open</div>
                      </div>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {priorityData.map((p) => (
                      <li key={p.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: PRIORITY_COLORS[p.name] }} />
                        {p.name}
                        <span className="ml-auto font-semibold">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          </div>

          {/* ---------- status mix ---------- */}
          <Section title="Where issues stand" subtitle="Every report by current status">
            <div className="flex h-4 overflow-hidden rounded-full bg-ink/8">
              {Object.entries(data.by_status).map(([s, n]) =>
                n > 0 ? (
                  <div key={s} title={`${STATUS_META[s]?.label}: ${n}`}
                       style={{ width: `${(100 * n) / statusTotal}%`, background: STATUS_COLORS[s] }} />
                ) : null
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {Object.entries(data.by_status).map(([s, n]) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                  {STATUS_META[s]?.label || s} <span className="font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* ---------- category table ---------- */}
          <Section title="By category" subtitle="Volume, resolution rate and how long fixes take">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="pb-2 font-semibold">Category</th>
                    <th className="pb-2 text-right font-semibold">Reports</th>
                    <th className="pb-2 text-right font-semibold">Resolved</th>
                    <th className="pb-2 pl-6 font-semibold">Resolution rate</th>
                    <th className="pb-2 text-right font-semibold">Avg. fix time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(data.by_category).map(([key, c]) => (
                    <tr key={key}>
                      <td className="py-3 font-medium">{CATEGORY_ICON[key] || "📍"} {c.label}</td>
                      <td className="py-3 text-right">{c.total}</td>
                      <td className="py-3 text-right">{c.resolved}</td>
                      <td className="py-3 pl-6"><RateBar value={c.resolved} total={c.total} /></td>
                      <td className="py-3 text-right">{formatHours(c.avg_resolution_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ---------- teams ---------- */}
          <Section title="By team" subtitle="Workload and speed for each responsible team">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.by_team).map(([team, t]) => (
                <div key={team} className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex items-center gap-2 font-display text-lg font-bold">
                    <span>{TEAM_ICON[team] || "🛠️"}</span>{team}
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Assigned</dt><dd className="font-semibold">{t.assigned}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Open</dt><dd className="font-semibold text-accent">{t.open}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Resolved</dt><dd className="font-semibold text-low">{t.resolved}</dd></div>
                    <div className="flex justify-between border-t border-line pt-1.5">
                      <dt className="text-muted">Avg. fix time</dt><dd className="font-semibold">{formatHours(t.avg_resolution_hours)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
