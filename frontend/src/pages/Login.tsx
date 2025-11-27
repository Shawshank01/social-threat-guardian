import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type LocationState = {
  from?: { pathname?: string };
  registered?: boolean;
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticating } = useAuth();
  const state = (location.state as LocationState) ?? {};

  const isEmailValid = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const isPasswordValid = useMemo(() => password.trim().length >= 8, [password]);
  const formInvalid = !isEmailValid || !isPasswordValid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formInvalid) {
      setError("Please enter a valid email and password (minimum 8 characters).");
      return;
    }

    setError(null);
    try {
      await login({ email, password });
      const redirectTo = state.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError((err as Error).message ?? "Invalid email or password.");
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <header className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Sign in to access your dashboards and threat monitoring configuration.
        </p>
        {state.registered && (
          <p className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Account created successfully. Please sign in.
          </p>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70"
      >
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            autoComplete="email"
            placeholder="you@example.org"
            aria-invalid={!isEmailValid}
            aria-describedby={!isEmailValid ? "login-email-error" : undefined}
          />
          {!isEmailValid && (
            <p id="login-email-error" className="text-xs font-semibold text-red-400">
              Enter a valid email address.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            autoComplete="current-password"
            placeholder=""
            aria-invalid={!isPasswordValid}
            aria-describedby={!isPasswordValid ? "login-password-error" : undefined}
          />
          {!isPasswordValid && (
            <p id="login-password-error" className="text-xs font-semibold text-red-400">
              Password must be at least 8 characters long.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isAuthenticating || formInvalid}
          className="w-full rounded-full bg-stg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAuthenticating ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-300">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="font-semibold text-stg-accent transition hover:text-stg-accent-soft"
          >
            Create one
          </button>
        </p>
      </form>
    </section>
  );
};

export default Login;
