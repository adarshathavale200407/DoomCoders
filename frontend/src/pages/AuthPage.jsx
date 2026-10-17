
import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Button, Card, Field } from "../components/ui.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isAdminLogin = mode === "admin-login";

  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect an already authenticated user to the correct area.
  if (user) {
    const destination =
      user.role === "admin"
        ? "/admin"
        : user.role === "citizen"
          ? "/dashboard"
          : "/manage";

    return <Navigate to={destination} replace />;
  }

  const set = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }));
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const authenticatedUser = isRegister
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password);

      // Admin login uses the existing authentication mechanism.
      // A user's role determines which area they can access.
      if (isAdminLogin && authenticatedUser.role !== "admin") {
        setError(
          "This account does not have administrator access. Please use an admin account."
        );

        // Do not navigate to an admin page for a non-admin.
        // The protected routes and backend must enforce authorization.
        return;
      }

      const fallback =
        authenticatedUser.role === "admin"
          ? "/admin"
          : authenticatedUser.role === "citizen"
            ? "/dashboard"
            : "/manage";

      navigate(
        location.state?.from || fallback,
        { replace: true }
      );
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = isRegister
    ? "Create your account"
    : isAdminLogin
      ? "Administrator Login"
      : "Welcome back";

  const description = isRegister
    ? "Sign up to report issues and track them."
    : isAdminLogin
      ? "Log in to access the administration dashboard."
      : "Log in to manage your reports.";

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>

      <p className="mb-6 text-muted">{description}</p>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <Field
              label="Full name"
              value={form.name}
              onChange={set("name")}
              required
              minLength={2}
              autoComplete="name"
              placeholder="Asha Patil"
            />
          )}

          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={isRegister ? 6 : undefined}
            autoComplete={
              isRegister ? "new-password" : "current-password"
            }
            placeholder={
              isRegister ? "At least 6 characters" : "Your password"
            }
          />

          <Alert>{error}</Alert>

          <Button
            type="submit"
            loading={busy}
            className="w-full"
          >
            {busy
              ? "Please wait..."
              : isRegister
                ? "Sign up"
                : isAdminLogin
                  ? "Log in as Admin"
                  : "Log in"}
          </Button>
        </form>
      </Card>

      {!isAdminLogin && (
        <p className="mt-5 text-center text-sm text-muted">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link
            to={isRegister ? "/login" : "/register"}
            className="font-semibold text-brand hover:underline"
          >
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      )}

      {isAdminLogin ? (
        <p className="mt-5 text-center text-sm text-muted">
          Not an administrator?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand hover:underline"
          >
            User login
          </Link>
        </p>
      ) : (
        !isRegister && (
          <p className="mt-4 text-center text-sm text-muted">
            Administrator?{" "}
            <Link
              to="/admin/login"
              className="font-semibold text-brand hover:underline"
            >
              Admin Login
            </Link>
          </p>
        )
      )}
    </div>
  );
}
