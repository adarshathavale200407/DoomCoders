import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Button, Card, Field } from "../components/ui.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = isRegister
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password);
      const fallback = u.role === "citizen" ? "/dashboard" : "/manage";
      navigate(location.state?.from || fallback, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="mb-2 text-3xl font-bold">{isRegister ? "Create your account" : "Welcome back"}</h1>
      <p className="mb-6 text-muted">
        {isRegister ? "Sign up to report issues and track them." : "Log in to manage your reports."}
      </p>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <Field label="Full name" value={form.name} onChange={set("name")}
                   required minLength={2} autoComplete="name" placeholder="Asha Patil" />
          )}
          <Field label="Email" type="email" value={form.email} onChange={set("email")}
                 required autoComplete="email" placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")}
                 required minLength={isRegister ? 6 : undefined}
                 autoComplete={isRegister ? "new-password" : "current-password"}
                 placeholder={isRegister ? "At least 6 characters" : "Your password"} />
          <Alert>{error}</Alert>
          <Button type="submit" loading={busy} className="w-full">
            {isRegister ? "Sign up" : "Log in"}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-sm text-muted">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link to={isRegister ? "/login" : "/register"} className="font-semibold text-brand hover:underline">
          {isRegister ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
