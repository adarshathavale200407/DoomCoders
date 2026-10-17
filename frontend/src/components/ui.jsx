const cx = (...c) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, loading, children, ...props }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    accent: "bg-accent text-white hover:brightness-95",
    ghost: "bg-transparent text-ink hover:bg-ink/5 border border-line",
  };
  return (
    <button
      disabled={loading || props.disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold",
        "transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
        styles[variant],
        className
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm
                   placeholder:text-muted/70 focus:border-brand focus:outline-none"
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-critical">{error}</span>}
    </label>
  );
}

export function Card({ className, children }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-card p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Spinner({ className = "h-6 w-6" }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="grid place-items-center py-24 text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Alert({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-critical/30 bg-critical/5 px-3.5 py-2.5 text-sm text-critical">
      {children}
    </div>
  );
}
