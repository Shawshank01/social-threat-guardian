import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  AtSign,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Save,
  User as UserIcon,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

type ServerUser = {
  id?: string;
  ID?: string;
  email?: string;
  EMAIL?: string;
  name?: string | null;
  NAME?: string | null;
  lastLoginAt?: string | null;
  LAST_LOGIN_AT?: string | null;
  last_login_at?: string | null;
};

const resolveString = (...values: (string | null | undefined)[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const Settings = () => {
  const { user, token } = useAuth();
  // Profile overview state updated from backend
  const [profileOverview, setProfileOverview] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  });
  // Form state for user input
  const [formState, setFormState] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    confirmPassword: "",
  });
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Initialise form state from user context
    setFormState({
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      confirmPassword: "",
    });
    // Initialise profile overview from user context
    setProfileOverview({
      name: user?.name ?? "",
      email: user?.email ?? "",
    });
    setLastLogin(null);
    setProfileError(null);
  }, [user?.id, user?.name, user?.email]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const controller = new AbortController();

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);
      const apiUrl = buildApiUrl(`users/${user.id}`);
      console.log("[Settings] Loading profile from:", apiUrl);

      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });

        console.log("[Settings] Response status:", response.status, response.statusText);

        const payload = (await response.json().catch((parseError) => {
          console.error("[Settings] Failed to parse response JSON:", parseError);
          return {};
        })) as {
          ok?: boolean;
          user?: ServerUser;
          error?: string;
        };

        console.log("[Settings] Response payload:", payload);

        if (!response.ok || payload.ok === false) {
          const errorMsg = payload.error ?? "Unable to load your profile details.";
          console.error("[Settings] Error response:", errorMsg);
          throw new Error(errorMsg);
        }

        const serverUser = payload.user ?? {};
        console.log("[Settings] Server user data:", serverUser);

        const resolvedName = resolveString(serverUser.name, serverUser.NAME);
        const resolvedEmail = resolveString(serverUser.email, serverUser.EMAIL);
        const resolvedLastLogin = resolveString(
          serverUser.lastLoginAt,
          serverUser.LAST_LOGIN_AT,
          serverUser.last_login_at
        );

        console.log("[Settings] Resolved last login:", resolvedLastLogin);

        // Update profile overview from backend data
        setProfileOverview({
          name: resolvedName ?? profileOverview.name,
          email: resolvedEmail ?? profileOverview.email,
        });

        // Update form state from backend data (only if form hasn't been modified)
        setFormState((prev) => ({
          name: resolvedName ?? prev.name,
          email: resolvedEmail ?? prev.email,
          password: prev.password, // Keep password field as-is
          confirmPassword: prev.confirmPassword, // Keep confirm password field as-is
        }));

        if (resolvedLastLogin) {
          setLastLogin(resolvedLastLogin);
        } else {
          console.warn("[Settings] No last login data found in response");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          console.log("[Settings] Request aborted");
          return;
        }
        const errorMsg = (err as Error).message || "Unable to load your profile details.";
        console.error("[Settings] Error loading profile:", err);
        setProfileError(errorMsg);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    void loadProfile();

    return () => controller.abort();
  }, [token, user?.id]);

  const formattedLastLogin = useMemo(() => {
    if (!lastLogin) {
      return "No login activity recorded yet.";
    }
    const asDate = new Date(lastLogin);
    if (Number.isNaN(asDate.getTime())) {
      return lastLogin;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(asDate);
  }, [lastLogin]);

  const trimmedEmail = useMemo(() => formState.email.trim(), [formState.email]);
  const trimmedPassword = useMemo(() => formState.password.trim(), [formState.password]);
  const trimmedConfirmPassword = useMemo(
    () => formState.confirmPassword.trim(),
    [formState.confirmPassword]
  );

  const isEmailValid = useMemo(() => {
    if (!trimmedEmail) return false;
    return /.+@.+\..+/.test(trimmedEmail);
  }, [trimmedEmail]);

  const isPasswordValid = useMemo(() => {
    if (!trimmedPassword) return true;
    return trimmedPassword.length >= 8;
  }, [trimmedPassword]);

  const passwordsMismatch = useMemo(() => {
    if (!trimmedPassword && !trimmedConfirmPassword) return false;
    return trimmedPassword !== trimmedConfirmPassword;
  }, [trimmedPassword, trimmedConfirmPassword]);

  const formInvalid = !isEmailValid || !isPasswordValid || passwordsMismatch;

  const handleInputChange = (
    field: "name" | "email" | "password" | "confirmPassword",
    value: string
  ) => {
    setSaveError(null);
    setSaveSuccess(false);
    setFormState((prev) => ({
      ...prev,
      [field]: field === "email" ? value.toLowerCase() : value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;

    const payload: Record<string, string> = {};
    const trimmedName = formState.name.trim();

    if (formInvalid) {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    if (trimmedName) payload.name = trimmedName;
    if (trimmedEmail && trimmedEmail !== (user.email ?? "").toLowerCase().trim()) {
      payload.email = trimmedEmail;
    }
    if (trimmedPassword) {
      if (!trimmedConfirmPassword) {
        setSaveError("Please confirm your new password before saving.");
        return;
      }
      payload.password = trimmedPassword;
    }

    if (Object.keys(payload).length === 0) {
      setSaveError("Please update at least one field before saving.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(buildApiUrl(`users/${user.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const payloadResponse = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: ServerUser;
      };

      if (!response.ok || payloadResponse.ok === false) {
        throw new Error(payloadResponse.error ?? "Unable to update your profile right now.");
      }

      const updatedUser = payloadResponse.user ?? {};
      const nextName = resolveString(updatedUser.name, updatedUser.NAME, trimmedName) ?? "";
      const nextEmail = resolveString(updatedUser.email, updatedUser.EMAIL, trimmedEmail) ?? "";
      const nextLastLogin = resolveString(
        updatedUser.lastLoginAt,
        updatedUser.LAST_LOGIN_AT,
        updatedUser.last_login_at
      );

      // Update profile overview from backend response
      setProfileOverview({
        name: nextName,
        email: nextEmail,
      });

      // Update form state from backend response
      setFormState({
        name: nextName,
        email: nextEmail,
        password: "",
        confirmPassword: "",
      });

      if (nextLastLogin) {
        setLastLogin(nextLastLogin);
      }

      setSaveSuccess(true);

      if (typeof window !== "undefined" && (nextName || nextEmail)) {
        try {
          const storageKey = "stg.auth.user";
          const stored = window.localStorage.getItem(storageKey);
          const parsed = stored ? JSON.parse(stored) : {};
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              ...parsed,
              name: nextName,
              email: nextEmail,
            })
          );
        } catch {
          // Ignore storage sync errors; the form already reflects the latest values.
        }
      }
    } catch (err) {
      setSaveError((err as Error).message || "Unable to update your profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <section className="mx-auto max-w-3xl space-y-6 px-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sign in to manage your personal account details and security preferences.
          </p>
        </header>
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm text-slate-600 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          We could not find an active session. Please log in to view and update your profile.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-8 px-4 pb-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Account Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review your login details and keep your personal information up to date.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
          <header className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stg-accent/15 text-stg-accent">
              <UserIcon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Profile overview</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                These details come from your latest login session.
              </p>
            </div>
          </header>

          {profileError && (
            <p className="mb-4 rounded-2xl border border-red-400/70 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
              {profileError}
            </p>
          )}

          <dl className="grid gap-4 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            <div className="space-y-1 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <UserIcon className="h-4 w-4" aria-hidden />
                Username
              </dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white">
                {profileOverview.name || "Not provided"}
              </dd>
            </div>

            <div className="space-y-1 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <AtSign className="h-4 w-4" aria-hidden />
                Email address
              </dt>
              <dd className="text-sm font-medium text-slate-900 break-all dark:text-white">
                {profileOverview.email || "Not provided"}
              </dd>
            </div>

            <div className="space-y-1 rounded-2xl border border-slate-200/70 bg-white/70 p-4 sm:col-span-2 dark:border-white/10 dark:bg-slate-900/40">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Clock className="h-4 w-4" aria-hidden />
                Last login
              </dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white">
                {isLoadingProfile ? "Loading last login…" : formattedLastLogin}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
          <header className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stg-accent/15 text-stg-accent">
              <Lock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Update personal info</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Changes take effect immediately after saving.
              </p>
            </div>
          </header>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="settings-name"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                Username
              </label>
              <input
                id="settings-name"
                name="name"
                type="text"
                value={formState.name}
                onChange={(event) => handleInputChange("name", event.target.value)}
                placeholder="Enter your display name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="settings-email"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                Email address
              </label>
              <input
                id="settings-email"
                name="email"
                type="email"
                value={formState.email}
                onChange={(event) => handleInputChange("email", event.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                aria-invalid={!isEmailValid}
                aria-describedby={!isEmailValid ? "settings-email-error" : undefined}
              />
              {!isEmailValid && (
                <p
                  id="settings-email-error"
                  className="text-xs font-semibold text-red-400 dark:text-red-300"
                >
                  Enter a valid email address.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="settings-password"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="settings-password"
                name="password"
                type="password"
                value={formState.password}
                onChange={(event) => handleInputChange("password", event.target.value)}
                placeholder="Set a new password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                autoComplete="new-password"
                aria-invalid={!isPasswordValid}
                aria-describedby={!isPasswordValid ? "settings-password-error" : undefined}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Leave blank to keep your current password.
              </p>
              {!isPasswordValid && (
                <p
                  id="settings-password-error"
                  className="text-xs font-semibold text-red-400 dark:text-red-300"
                >
                  Password must be at least 8 characters long.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="settings-confirm-password"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                Confirm password
              </label>
              <input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                value={formState.confirmPassword}
                onChange={(event) => handleInputChange("confirmPassword", event.target.value)}
                placeholder="Retype the new password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                autoComplete="new-password"
                aria-invalid={passwordsMismatch}
                aria-describedby={passwordsMismatch ? "settings-confirm-password-error" : undefined}
              />
              {passwordsMismatch && (
                <p
                  id="settings-confirm-password-error"
                  className="text-xs font-semibold text-red-400 dark:text-red-300"
                >
                  Passwords do not match.
                </p>
              )}
            </div>

            {saveError && (
              <p className="rounded-2xl border border-red-400/70 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
                {saveError}
              </p>
            )}

            {saveSuccess && (
              <p className="flex items-center gap-2 rounded-2xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Profile updated successfully.
              </p>
            )}

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isSaving || formInvalid}
                className="inline-flex items-center gap-2 rounded-full bg-stg-accent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/40 disabled:cursor-not-allowed disabled:bg-stg-accent/60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
};

export default Settings;
