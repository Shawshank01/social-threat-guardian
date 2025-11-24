import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, isAuthenticating, token, user } = useAuth();
  const navigate = useNavigate();

  // Check if user is already logged in and redirect to Dashboard
  useEffect(() => {
    if (token && user) {
      const timer = setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [token, user, navigate]);

  const isUsernameValid = useMemo(() => username.trim().length >= 3, [username]);
  const isEmailValid = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const isPasswordValid = useMemo(() => password.trim().length >= 8, [password]);
  const passwordsMismatch = useMemo(() => {
    return Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword;
  }, [password, confirmPassword]);
  const formInvalid = !isUsernameValid || !isEmailValid || !isPasswordValid || passwordsMismatch;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formInvalid) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await register({ name: username, email, password });
      setSuccess("Account created successfully.");
      setTimeout(() => {
        navigate("/login", { state: { registered: true } });
      }, 600);
    } catch (err) {
      setError((err as Error).message ?? "Unable to create account.");
    }
  };

  // If user is already logged in, show message and redirect
  if (token && user) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="space-y-6 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center shadow-soft transition-colors dark:border-emerald-500/30 dark:bg-emerald-500/20">
          <h1 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-100">
            You are already logged in
          </h1>
          <p className="text-sm text-emerald-600 dark:text-emerald-200">
            You are currently logged in as <span className="font-semibold">{user.name ?? "Analyst"}</span>.
            Redirecting you to the Dashboard...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <header className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create an account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Register to save monitoring preferences and receive targeted alerts.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70"
      >
        <div className="space-y-1.5">
          <label htmlFor="register-username" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Username
          </label>
          <input
            id="register-username"
            type="text"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="YourUserName"
            aria-invalid={!isUsernameValid}
            aria-describedby={!isUsernameValid ? "register-username-error" : undefined}
          />
          {!isUsernameValid && (
            <p id="register-username-error" className="text-xs font-semibold text-red-400">
              Username must be at least 3 characters long.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            autoComplete="email"
            placeholder="you@example.org"
            aria-invalid={!isEmailValid}
            aria-describedby={!isEmailValid ? "register-email-error" : undefined}
          />
          {!isEmailValid && (
            <p id="register-email-error" className="text-xs font-semibold text-red-400">
              Enter a valid email address.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-password"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            autoComplete="new-password"
            placeholder=""
            aria-invalid={!isPasswordValid}
            aria-describedby={!isPasswordValid ? "register-password-error" : undefined}
          />
          {!isPasswordValid && (
            <p id="register-password-error" className="text-xs font-semibold text-red-400">
              Password must be at least 8 characters long.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-confirm-password"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Confirm password
          </label>
          <input
            id="register-confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            autoComplete="new-password"
            placeholder=""
            aria-invalid={passwordsMismatch}
            aria-describedby={passwordsMismatch ? "register-confirm-password-error" : undefined}
          />
          {passwordsMismatch && (
            <p id="register-confirm-password-error" className="text-xs font-semibold text-red-400">
              Passwords do not match.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isAuthenticating || formInvalid}
          className="w-full rounded-full bg-stg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAuthenticating ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-300">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-semibold text-stg-accent transition hover:text-stg-accent-soft"
          >
            Sign in
          </button>
        </p>
      </form>
    </section>
  );
};

export default Register;
