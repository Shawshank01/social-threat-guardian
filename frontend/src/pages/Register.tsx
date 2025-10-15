import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, isAuthenticating } = useAuth();
  const navigate = useNavigate();

  const passwordsMismatch = useMemo(() => {
    return Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword;
  }, [password, confirmPassword]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordsMismatch) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await register({ username, email, password });
      setSuccess("Account created successfully.");
      setTimeout(() => {
        navigate("/login", { state: { registered: true } });
      }, 600);
    } catch (err) {
      setError((err as Error).message ?? "Unable to create account.");
    }
  };

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
            placeholder="ThreatGuardian"
          />
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
          />
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
          />
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
          />
          {passwordsMismatch && (
            <p className="text-xs font-semibold text-red-400">Passwords do not match.</p>
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
          disabled={isAuthenticating}
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
