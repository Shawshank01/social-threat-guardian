import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type SavedPreferences } from "@/types/monitors";
import { normalizePreferences } from "@/utils/preferences";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const PLATFORM_OPTIONS = [
  { id: "BLUSKY_TEST", label: "Bluesky" },
  { id: "MASTODON", label: "Mastodon" },
  { id: "TELEGRAM", label: "Telegram" },
];
const DEFAULT_PLATFORM_ID = "BLUSKY_TEST";
const ACTIVE_PLATFORM_OPTIONS = PLATFORM_OPTIONS.filter(
  (platform) => platform.id === DEFAULT_PLATFORM_ID,
);
const makeDefaultThresholds = () => {
  const defaults: Record<string, number | null> = {};
  ACTIVE_PLATFORM_OPTIONS.forEach((platform) => {
    defaults[platform.id] = null;
  });
  return defaults;
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "id", label: "Indonesian" },
  { value: "de", label: "German" },
];

const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [keywordInput, setKeywordInput] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set([DEFAULT_PLATFORM_ID]),
  );
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    () => new Set(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keywordInputWarning, setKeywordInputWarning] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNavigationPrompt, setShowNavigationPrompt] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [lastSavedSettings, setLastSavedSettings] = useState<{
    keywords: string[];
    platforms: string[];
    languages: string[];
  } | null>(null);
  const [isSyncingPreferences, setIsSyncingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [threatIndexAlertsEnabled, setThreatIndexAlertsEnabled] = useState(false);
  const [threatIndexThresholds, setThreatIndexThresholds] = useState<Record<string, number | null>>(
    () => makeDefaultThresholds(),
  );
  const [threatIndexThresholdInputs, setThreatIndexThresholdInputs] = useState<Record<string, string>>(() => {
    const defaults = makeDefaultThresholds();
    const inputs: Record<string, string> = {};
    ACTIVE_PLATFORM_OPTIONS.forEach((platform) => {
      inputs[platform.id] = defaults[platform.id] === null ? "" : String(defaults[platform.id]);
    });
    return inputs;
  });
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const applySavedPreferences = useCallback(
    (preferences: SavedPreferences) => {
      const resolveThresholdForPlatform = (raw: unknown, platformId: string): number | undefined => {
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        if (Array.isArray(raw)) {
          const firstNumber = raw
            .map((entry) => (entry === null || entry === undefined ? NaN : Number(entry)))
            .find((entry) => Number.isFinite(entry));
          return firstNumber;
        }
        if (raw && typeof raw === "object") {
          const record = raw as Record<string, unknown>;
          const rawValue = record[platformId];
          if (rawValue !== null && rawValue !== undefined) {
            const candidate = Number(rawValue);
            if (Number.isFinite(candidate)) return candidate;
          }
          const firstRecordNumber = Object.values(record)
            .map((entry) => (entry === null || entry === undefined ? NaN : Number(entry)))
            .find((entry) => Number.isFinite(entry));
          return firstRecordNumber;
        }
        return undefined;
      };

      const seenKeywords = new Set<string>();
      const trimmedKeywords = preferences.keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => {
          if (!keyword) return false;
          const key = keyword.toLowerCase();
          if (seenKeywords.has(key)) return false;
          seenKeywords.add(key);
          return true;
        });

      const originalPlatformIds = Array.isArray(preferences.platforms) ? preferences.platforms : [];
      const validPlatformIds = [DEFAULT_PLATFORM_ID];
      const platformsToApply = validPlatformIds;

      const originalLanguageIds = Array.isArray(preferences.languages) ? preferences.languages : [];
      const validLanguageIds = Array.from(
        new Set(
          originalLanguageIds.filter((languageId) =>
            LANGUAGE_OPTIONS.some((language) => language.value === languageId),
          ),
        ),
      );
      const languagesToApply = validLanguageIds;

      const thresholdsFromBackend = preferences.threatIndexThresholds ?? {};
      const mergedThresholds = makeDefaultThresholds();
      ACTIVE_PLATFORM_OPTIONS.forEach((platform) => {
        const value = resolveThresholdForPlatform(thresholdsFromBackend, platform.id);
        if (Number.isFinite(value)) {
          mergedThresholds[platform.id] = Math.max(0, Math.min(100, Number(value)));
        }
      });

      setKeywordInput(trimmedKeywords.join("\n"));
      setSelectedPlatforms(new Set(platformsToApply));
      setSelectedLanguages(new Set(languagesToApply));
      setThreatIndexAlertsEnabled(Boolean(preferences.threatIndexAlertsEnabled));
      setThreatIndexThresholds(mergedThresholds);
      setThreatIndexThresholdInputs(
        ACTIVE_PLATFORM_OPTIONS.reduce<Record<string, string>>((acc, platform) => {
          const value = mergedThresholds[platform.id];
          acc[platform.id] = value === null || value === undefined ? "" : String(value);
          return acc;
        }, {}),
      );

      const hasExplicitPreferences =
        trimmedKeywords.length > 0 ||
        originalPlatformIds.length > 0 ||
        originalLanguageIds.length > 0;

      if (hasExplicitPreferences) {
        setLastSavedSettings({
          keywords: trimmedKeywords,
          platforms: platformsToApply.map(
            (platformId) =>
              PLATFORM_OPTIONS.find((platform) => platform.id === platformId)?.label ?? platformId,
          ),
          languages: languagesToApply.map(
            (languageId) =>
              LANGUAGE_OPTIONS.find((language) => language.value === languageId)?.label ?? languageId,
          ),
        });
      } else {
        setLastSavedSettings(null);
      }
    },
    [
      setKeywordInput,
      setLastSavedSettings,
      setSelectedLanguages,
      setSelectedPlatforms,
      setThreatIndexAlertsEnabled,
      setThreatIndexThresholds,
      setThreatIndexThresholdInputs,
    ],
  );

  const normalizedKeywords = useMemo(() => {
    const seen = new Set<string>();
    return keywordInput
      .split(/[\n,]/)
      .map((keyword) => keyword.trim())
      .filter((keyword) => {
        if (!keyword) return false;
        const key = keyword.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [keywordInput]);

  useEffect(() => {
    if (!user?.id || !token) {
      setPreferencesError("You need to be signed in to load your monitoring preferences.");
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    const loadPreferences = async () => {
      setIsSyncingPreferences(true);
      setPreferencesError(null);
      try {
        const response = await fetch(buildApiUrl("user-preferences"), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          preferences?: SavedPreferences;
        };

        if (response.status === 401) {
          logout();
          navigate("/login", {
            state: {
              from: { pathname: "/dashboard" },
              message: "Your session has expired. Please log in again."
            }
          });
          return;
        }

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load saved settings from the server.");
        }

        const normalized: SavedPreferences =
          normalizePreferences(payload.preferences) ?? {
            keywords: [],
            platforms: [],
            languages: [],
          };

        const mergedPreferences: SavedPreferences = {
          ...normalized,
          platforms: normalized.platforms || [],
          languages: normalized.languages || [],
        };

        if (isCancelled) return;

        applySavedPreferences(mergedPreferences);
        setPreferencesError(null);
      } catch (error) {
        if (isCancelled || (error as Error).name === "AbortError") return;

        const errorMessage = (error as Error).message || "";
        if (errorMessage.includes("expired") || errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
          logout();
          navigate("/login", {
            state: {
              from: { pathname: "/dashboard" },
              message: "Your session has expired. Please log in again."
            }
          });
          return;
        }

        setPreferencesError(
          errorMessage || "Unable to load saved settings right now. Configure new preferences and save again.",
        );
      } finally {
        if (!isCancelled) {
          setIsSyncingPreferences(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [applySavedPreferences, token, user?.id]);

  const persistPreferencesToBackend = async (preferences: SavedPreferences) => {
    if (!user?.id || !token) {
      logout();
      navigate("/login", {
        state: {
          from: { pathname: "/dashboard" },
          message: "Your session has expired. Please log in again."
        }
      });
      return false;
    }

    try {
      const response = await fetch(buildApiUrl("user-preferences"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          keywords: preferences.keywords,
          languages: preferences.languages,
          platforms: preferences.platforms,
          threatIndexAlertsEnabled: preferences.threatIndexAlertsEnabled ?? false,
        threatIndexThresholds: preferences.threatIndexThresholds ?? makeDefaultThresholds(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        preferences?: SavedPreferences;
      };

      if (response.status === 401) {
        logout();
        navigate("/login", {
          state: {
            from: { pathname: "/dashboard" },
            message: "Your session has expired. Please log in again."
          }
        });
        return false;
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to update saved settings on the server.");
      }

      setPreferencesError(null);
      return true;
    } catch (error) {
      console.error("Failed to persist dashboard preferences", error);
      const errorMessage = (error as Error).message || "";
      // Check if error indicates token expiration
      if (errorMessage.includes("expired") || errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
        logout();
        navigate("/login", {
          state: {
            from: { pathname: "/dashboard" },
            message: "Your session has expired. Please log in again."
          }
        });
        return false;
      }

      setPreferencesError(
        errorMessage || "Unable to sync settings to the server. Please try again later.",
      );
      return false;
    }
  };

  const enforceDefaultPlatform = () => {
    setSelectedPlatforms(new Set([DEFAULT_PLATFORM_ID]));
  };

  const togglePlatform = (_platformId?: string) => {
    // Keep Bluesky enforced until multi-platform support returns
    enforceDefaultPlatform();
  };

  const resetPlatforms = () => {
    enforceDefaultPlatform();
  };

  const toggleLanguage = (language: string) => {
    setSelectedLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(language)) {
        next.delete(language);
      } else {
        next.add(language);
      }
      return next;
    });
  };

  const resetLanguages = () => {
    setSelectedLanguages(new Set());
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (normalizedKeywords.length === 0) {
      setSaveError("Enter at least one keyword to save.");
      setSaveSuccess(false);
      setShowNavigationPrompt(false);
      return;
    }

    if (selectedPlatforms.size === 0) {
      setSaveError("Select at least one platform.");
      setSaveSuccess(false);
      setShowNavigationPrompt(false);
      return;
    }

    if (selectedLanguages.size === 0) {
      setSaveError("Select at least one language option.");
      setSaveSuccess(false);
      setShowNavigationPrompt(false);
      return;
    }

    if (threatIndexAlertsEnabled) {
      const missingThreshold = ACTIVE_PLATFORM_OPTIONS.some(
        (platform) => !Number.isFinite(threatIndexThresholds[platform.id]),
      );
      if (missingThreshold) {
        setSaveError("Enter a numeric alert threshold before enabling notifications.");
        setSaveSuccess(false);
        setShowNavigationPrompt(false);
        return;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setShowNavigationPrompt(false);

    try {
      const preferencesToPersist: SavedPreferences = {
        keywords: normalizedKeywords,
        platforms: Array.from(selectedPlatforms),
        languages: Array.from(selectedLanguages),
        threatIndexAlertsEnabled,
        threatIndexThresholds,
        updatedAt: new Date().toISOString(),
      };

      const success = await persistPreferencesToBackend(preferencesToPersist);

      if (success) {
        const savedPlatforms = preferencesToPersist.platforms.map(
          (platformId) => PLATFORM_OPTIONS.find((platform) => platform.id === platformId)?.label ?? platformId,
        );
        const savedLanguages = preferencesToPersist.languages.map(
          (languageId) => LANGUAGE_OPTIONS.find((language) => language.value === languageId)?.label ?? languageId,
        );

        setLastSavedSettings({
          keywords: preferencesToPersist.keywords,
          platforms: savedPlatforms,
          languages: savedLanguages,
        });
        setSaveSuccess(true);
        setShowNavigationPrompt(true);
        setRedirectCountdown(3);

        // Start countdown timer
        countdownTimerRef.current = setInterval(() => {
          setRedirectCountdown((prev) => {
            if (prev <= 1) {
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Auto-redirect after 3 seconds
        redirectTimerRef.current = setTimeout(() => {
          setShowNavigationPrompt(false);
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          navigate("/personal-monitors");
        }, 3000);
      } else {
        setSaveError("Failed to save preferences. Please try again.");
      }
    } catch (error) {
      setSaveError((error as Error).message || "Failed to save preferences. Try again.");
      setSaveSuccess(false);
      setShowNavigationPrompt(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoToPersonalMonitors = () => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setShowNavigationPrompt(false);
    navigate("/personal-monitors");
  };

  const handleStayOnDashboard = () => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setShowNavigationPrompt(false);
  };

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const sanitizeKeywordInput = (value: string) => {
    // Allow letters, numbers, spaces, commas, and new lines only
    const sanitized = value.replace(/[^a-zA-Z0-9,\s]/g, "");
    if (sanitized !== value) {
      setKeywordInputWarning("Only letters, numbers, spaces, commas, and new lines are allowed.");
    } else {
      setKeywordInputWarning(null);
    }
    return sanitized;
  };

  const handleExportKeywords = () => {
    if (!keywordInput.trim()) {
      setSaveError("No keywords to export. Enter some keywords first.");
      return;
    }

    const blob = new Blob([keywordInput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keywords.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportKeywords = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      setSaveError("Please select a .txt file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setKeywordInput(sanitizeKeywordInput(content));
        setSaveError(null);
      }
    };
    reader.onerror = () => {
      setSaveError("Failed to read the file. Please try again.");
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Welcome back, {user?.name ?? "Analyst"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Fine-tune your monitoring preferences to surface posts that match mission-critical keywords.
        </p>
      </header>

      {isSyncingPreferences && (
        <p className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          Syncing your saved monitoring settings…
        </p>
      )}

      {preferencesError && (
        <p className="rounded-2xl border border-amber-500/60 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100">
          {preferencesError}
        </p>
      )}

      <form
        onSubmit={handleSearch}
        className="space-y-8 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70"
      >
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Keyword search</h2>
            <Link
              to="/about"
              className="text-xs font-medium text-stg-accent underline-offset-2 hover:underline dark:text-stg-accent"
            >
              Learn more
            </Link>
          </header>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter the keywords you want to monitor. Separate multiple entries with commas or new lines.
          </p>
          <textarea
            value={keywordInput}
            onChange={(event) => setKeywordInput(sanitizeKeywordInput(event.target.value))}
            className="h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/30 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="e.g., name, location, event, activity, ID number, behaviour"
          />
          {keywordInputWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              {keywordInputWarning}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportKeywords}
              disabled={!keywordInput.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-stg-accent hover:text-stg-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export as TXT
            </button>
            <button
              type="button"
              onClick={handleImportKeywords}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Import from TXT
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Import keywords from file"
            />
          </div>
        </section>

        {/* Platform selection hidden until additional platforms are supported */}
        {false && (
          <section className="space-y-4">
            <header>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Platforms</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Choose the platforms to include in your search. Select any combination that fits your watch list.
              </p>
            </header>
            <div className="flex flex-wrap gap-3">
              {ACTIVE_PLATFORM_OPTIONS.map((platform) => {
                const isSelected = selectedPlatforms.has(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 ${isSelected
                      ? "bg-stg-accent text-white shadow"
                      : "border border-slate-300/80 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      }`}
                    aria-pressed={isSelected}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={resetPlatforms}
              className="text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:text-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/40"
            >
              Reset
            </button>
          </section>
        )}

        <section className="space-y-4">
          <header>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Languages</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Select the language identifiers to filter by. Support for full language names arrives soon.
            </p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LANGUAGE_OPTIONS.map((language) => {
              const isSelected = selectedLanguages.has(language.value);
              return (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => toggleLanguage(language.value)}
                  className={`flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 ${isSelected
                    ? "border-stg-accent bg-stg-accent text-white shadow-lg"
                    : "border-slate-300/80 bg-white text-slate-700 hover:border-stg-accent/40 hover:text-stg-accent dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-stg-accent/60"
                    }`}
                  aria-pressed={isSelected}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={resetLanguages}
            className="text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:text-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/40"
          >
            Reset
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-900/40">
          <header>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notification Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Configure how you receive notifications about Threat Index alerts and other important updates.
            </p>
          </header>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-800/50">
              <div className="flex-1 pr-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Threat Index Alerts</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Receive notifications when Threat Index value exceeds your threshold
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                <input
                  type="checkbox"
                  checked={threatIndexAlertsEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setThreatIndexAlertsEnabled(enabled);
                  }}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-stg-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-stg-accent/40 dark:bg-slate-700 dark:after:border-slate-600 dark:after:bg-slate-300"></div>
              </label>
            </div>

            {threatIndexAlertsEnabled && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-800/50">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Alert Thresholds by Platform
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                    Set the Threat Index threshold for Bluesky (0-100). Support for additional platforms is coming soon. Suggested starting point: 30.
                  </p>
                  <div className="space-y-3">
                    {ACTIVE_PLATFORM_OPTIONS.map((platform) => {
        const threshold = threatIndexThresholds[platform.id];
        const thresholdInput =
          threatIndexThresholdInputs[platform.id] ?? (threshold ?? "")?.toString();
                      return (
                        <div
                          key={platform.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3 border-slate-300/80 bg-white dark:border-white/20 dark:bg-slate-900/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`threshold-${platform.id}`}
                                className="text-sm font-medium text-slate-900 dark:text-white"
                              >
                                {platform.label}
                              </label>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              id={`threshold-${platform.id}`}
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={thresholdInput}
                              placeholder="30"
                              onChange={(e) => {
                                const raw = e.target.value;
                                setThreatIndexThresholdInputs((prev) => ({
                                  ...prev,
                                  [platform.id]: raw,
                                }));
                                if (raw.trim() === "") {
                                  setThreatIndexThresholds((prev) => ({
                                    ...prev,
                                    [platform.id]: null,
                                  }));
                                  return;
                                }
                                const numeric = Number(raw);
                                if (!Number.isFinite(numeric)) {
                                  return;
                                }
                                const value = Math.max(0, Math.min(100, numeric));
                                setThreatIndexThresholds((prev) => ({
                                  ...prev,
                                  [platform.id]: value,
                                }));
                              }}
                              className="w-20 rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:border-stg-accent"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">
                              {threshold ?? "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-slate-800/30">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <strong className="font-semibold text-slate-700 dark:text-slate-300">Note:</strong>{" "}
                {threatIndexAlertsEnabled
                  ? `You will receive notifications when the Threat Index value exceeds the threshold for enabled platform. Notifications are throttled to prevent spam (6-hour cooldown between alerts).`
                  : "Threat Index alerts are currently disabled. Enable them above to receive notifications when the threshold is exceeded."}{" "}
                You can view and manage your notifications using the bell icon in the navigation bar.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            {lastSavedSettings ? (
              <span>
                Last saved search: {lastSavedSettings.keywords.join(", ")} • Platforms:{" "}
                {lastSavedSettings.platforms.join(", ")} • Languages: {lastSavedSettings.languages.join(", ")}
              </span>
            ) : (
              <span>Configure your keywords and languages, then save to load matching posts.</span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stg-accent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save preferences"
            )}
          </button>
        </div>

        {saveError && (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
            {saveError}
          </p>
        )}

        {isSaving && (
          <div className="flex items-center gap-3 rounded-2xl border border-blue-500/60 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Saving your preferences...</span>
          </div>
        )}

        {saveSuccess && !isSaving && (
          <div className="flex items-center gap-3 rounded-2xl border border-green-500/60 bg-green-500/15 px-4 py-3 text-sm font-semibold text-green-700 dark:border-green-500/40 dark:bg-green-500/20 dark:text-green-100">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            <span>Preferences saved successfully!</span>
          </div>
        )}
      </form>

      {showNavigationPrompt && (
        <>
          {/* Modal overlay */}
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleStayOnDashboard}
          />
          {/* Modal popup */}
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stg-accent/10 dark:bg-stg-accent/20">
                  <CheckCircle2 className="h-6 w-6 text-stg-accent" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Preferences Saved!
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You will be redirected to the Personal Monitors page in{" "}
                <span className="font-semibold text-stg-accent">{redirectCountdown}</span>{" "}
                {redirectCountdown === 1 ? "second" : "seconds"} to view the results.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGoToPersonalMonitors}
                  className="flex-1 rounded-lg bg-stg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60"
                >
                  Go Now
                </button>
                <button
                  type="button"
                  onClick={handleStayOnDashboard}
                  className="flex-1 rounded-lg border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Dashboard;
