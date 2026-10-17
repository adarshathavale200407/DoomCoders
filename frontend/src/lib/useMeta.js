import { useEffect, useState } from "react";
import { api } from "./api.js";

let cache = null; // fetched once per page load

/** Categories, teams and statuses from GET /meta. Returns null while loading. */
export function useMeta() {
  const [meta, setMeta] = useState(cache);
  useEffect(() => {
    if (cache) return;
    api.get("/meta").then((m) => {
      cache = m;
      setMeta(m);
    }).catch(() => {});
  }, []);
  return meta;
}
