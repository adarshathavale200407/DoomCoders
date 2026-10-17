import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  // Restore session on page load
  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const finish = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // `requireRole` (e.g. "admin") is checked before anything is stored, so a
  // wrong-role login never becomes a session.
  const login = useCallback(
    async (email, password, requireRole) => {
      const data = await api.post("/auth/login", { email, password });
      if (requireRole && data.user.role !== requireRole) {
        throw new Error("This account does not have administrator access. Please use an admin account.");
      }
      return finish(data);
    },
    [finish]
  );
  const register = useCallback(
    (name, email, password) => api.post("/auth/register", { name, email, password }).then(finish),
    [finish]
  );
  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
