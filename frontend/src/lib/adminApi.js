// All admin + issue-action calls in one place.
// ASSUMPTION: ./api.js exposes api.get/post/patch/delete(path, body?) and throws Error with a readable message.
// If your client uses different method names, fix them here only.
import { api } from "./api.js";

const qs = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) s.set(k, v);
  }
  const t = s.toString();
  return t ? `?${t}` : "";
};

export const adminApi = {
  overview: () => api.get("/admin/overview"),
  issues: (params) => api.get(`/admin/issues${qs(params)}`),
  addNote: (id, note) => api.post(`/admin/issues/${id}/note`, { note }),
  deleteIssue: (id) => api.delete(`/admin/issues/${id}`),
  duplicates: () => api.get("/admin/duplicates"),
  dismissDuplicate: (id) => api.post(`/admin/issues/${id}/dismiss-duplicate`),
  users: (params) => api.get(`/admin/users${qs(params)}`),
  setBan: (id, banned) => api.patch(`/admin/users/${id}/ban`, { banned }),
  setRole: (id, role, team) => api.patch(`/admin/users/${id}/role`, { role, team: team || null }),

  // Shared endpoints from routers/issues.py. ASSUMPTION: body shapes below; check against issues.py.
  setStatus: (id, status) => api.patch(`/issues/${id}/status`, { status }),
  assign: (id, team) => api.patch(`/issues/${id}/assign`, { team }),
  merge: (id, targetId) => api.post(`/issues/${id}/merge`, { target_id: targetId }),
};
