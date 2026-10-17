import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const STEPS = [
  { n: "1", title: "Report", text: "Snap a photo, pin the spot, pick a category. We flag duplicates before you submit." },
  { n: "2", title: "Prioritise", text: "Severity, community impact and time unresolved decide what gets fixed first." },
  { n: "3", title: "Resolve", text: "The right team is assigned and posts updates until it's done." },
];

const CATEGORIES = ["Potholes", "Water leaks", "Overflowing garbage", "Broken streetlights"];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 py-6 md:grid-cols-2">
        <div>
          <p className="mb-4 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Your neighbourhood, your voice
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] md:text-5xl">
            See a problem on your street? Get it fixed.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Report civic issues in under a minute, find out who's responsible,
            and follow every update until it's resolved.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/report" : "/register"}
                  className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:brightness-95">
              {user ? "Report an issue" : "Get started"}
            </Link>
            <Link to="/issues"
                  className="rounded-lg border border-line px-5 py-3 text-sm font-semibold hover:bg-ink/5">
              Browse reports
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-muted">What can I report?</p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => (
              <div key={c} className="rounded-xl border border-line bg-paper px-4 py-5 text-sm font-semibold">
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-card p-6">
              <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
