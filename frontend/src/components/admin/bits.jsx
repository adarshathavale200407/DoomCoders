import { useEffect, useState } from "react";
import { Button } from "../ui.jsx";

export const errMsg = (e) => e?.message || "Something went wrong. Try again.";

export const selectCls =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:opacity-60";

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** meta lists may be strings or {id|value|name, label} objects; normalise to {value,label}. */
export function options(list) {
  return (list || []).map((x) =>
    typeof x === "string"
      ? { value: x, label: x.replace(/_/g, " ") }
      : { value: x.id ?? x.value ?? x.name, label: x.label ?? x.name ?? x.id ?? x.value }
  );
}

export function Pagination({ page, pages, total, onPage }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="py-12 text-center text-sm text-muted">{children}</div>;
}
