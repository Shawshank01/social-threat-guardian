import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type SavedPreferences } from "@/types/monitors";
import {
  loadPreferencesFromStorage,
  normalizePreferences,
  savePreferencesToStorage,
} from "@/utils/monitoringStorage";

type CommentMatch = {
  postText?: string | null;
  predIntent?: string | null;
  timeAgo?: string | null;
};

type KeywordResultPayload = {
  keyword?: string;
  count?: number;
  comments?: CommentMatch[];
};

type SearchResponse = {
  ok?: boolean;
  error?: string;
  results?: KeywordResultPayload[];
  sourceTable?: string;
  platform?: string;
};

type PlatformResult = {
  platform: string;
  sourceTable: string;
  results: {
    keyword: string;
    count: number;
    comments: CommentMatch[];
  }[];
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const SEARCH_RESULTS_LIMIT = 3;

const PLATFORM_OPTIONS = [
  { id: "BLUSKY_TEST", label: "Bluesky" },
  { id: "MASTODON", label: "Mastodon" },
  { id: "TELEGRAM", label: "Telegram" },
];

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
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [keywordInput, setKeywordInput] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set(PLATFORM_OPTIONS.map((platform) => platform.id)),
  );
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    () => new Set(LANGUAGE_OPTIONS.map((language) => language.value)),
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PlatformResult[]>([]);
  const [showNavigationPrompt, setShowNavigationPrompt] = useState(false);
  const [lastSavedSettings, setLastSavedSettings] = useState<{
    keywords: string[];
    platforms: string[];
    languages: string[];
  } | null>(null);
  const [isSyncingPreferences, setIsSyncingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  const applySavedPreferences = useCallback(
    (preferences: SavedPreferences) => {
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
      const validPlatformIds = Array.from(
        new Set(
          originalPlatformIds.filter((platformId) =>
            PLATFORM_OPTIONS.some((platform) => platform.id === platformId),
          ),
        ),
      );
      const platformsToApply =
        validPlatformIds.length > 0
          ? validPlatformIds
          : PLATFORM_OPTIONS.map((platform) => platform.id);

      const originalLanguageIds = Array.isArray(preferences.languages) ? preferences.languages : [];
      const validLanguageIds = Array.from(
        new Set(
          originalLanguageIds.filter((languageId) =>
            LANGUAGE_OPTIONS.some((language) => language.value === languageId),
          ),
        ),
      );
      const languagesToApply =
        validLanguageIds.length > 0
          ? validLanguageIds
          : LANGUAGE_OPTIONS.map((language) => language.value);

      setKeywordInput(trimmedKeywords.join("\n"));
      setSelectedPlatforms(new Set(platformsToApply));
      setSelectedLanguages(new Set(languagesToApply));

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
    [setKeywordInput, setLastSavedSettings, setSelectedLanguages, setSelectedPlatforms],
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
      const localPreferences = loadPreferencesFromStorage();
      if (localPreferences) {
        applySavedPreferences(localPreferences);
        setPreferencesError(
          user?.id
            ? "Unable to authenticate with the server. Using this browser's saved configuration."
            : "Sign in to sync preferences across devices. Using this browser's saved configuration.",
        );
      } else {
        setPreferencesError(null);
      }
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          preferences?: SavedPreferences;
        };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load saved settings from the server.");
        }

        const normalized: SavedPreferences =
          normalizePreferences(payload.preferences) ?? {
            keywords: [],
            platforms: [],
            languages: [],
          };

        const cachedPreferences = loadPreferencesFromStorage();
        const resolvedPlatforms =
          normalized.platforms.length > 0
            ? normalized.platforms
            : cachedPreferences?.platforms && cachedPreferences.platforms.length > 0
              ? cachedPreferences.platforms
              : PLATFORM_OPTIONS.map((platform) => platform.id);

        const mergedPreferences: SavedPreferences = {
          ...normalized,
          platforms: resolvedPlatforms,
        };

        if (isCancelled) return;

        applySavedPreferences(mergedPreferences);
        savePreferencesToStorage({
          ...mergedPreferences,
          updatedAt: new Date().toISOString(),
        });
        setPreferencesError(null);
      } catch (error) {
        if (isCancelled || (error as Error).name === "AbortError") return;

        const fallback = loadPreferencesFromStorage();
        if (fallback) {
          applySavedPreferences(fallback);
          setPreferencesError(
            (error as Error).message
              ? `${(error as Error).message} Using this browser's saved configuration instead.`
              : "Using this browser's saved configuration because the server is unavailable.",
          );
        } else {
          setPreferencesError(
            (error as Error).message ??
            "Unable to load saved settings right now. Configure new preferences and save again.",
          );
        }
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
      setPreferencesError(
        user?.id
          ? "Unable to authenticate with the server. We'll keep these changes on this browser."
          : "Sign in to sync your monitoring filters across devices. We'll keep these changes on this browser.",
      );
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
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        preferences?: SavedPreferences;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to update saved settings on the server.");
      }

      setPreferencesError(null);
      return true;
    } catch (error) {
      console.error("Failed to persist dashboard preferences", error);
      setPreferencesError(
        (error as Error).message ??
        "Unable to sync settings to the server. We'll keep your latest changes on this browser.",
      );
      return false;
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  const resetPlatforms = () => {
    setSelectedPlatforms(new Set(PLATFORM_OPTIONS.map((platform) => platform.id)));
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
    setSelectedLanguages(new Set(LANGUAGE_OPTIONS.map((language) => language.value)));
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (normalizedKeywords.length === 0) {
      setSearchError("Enter at least one keyword to search.");
      setSearchResults([]);
      setShowNavigationPrompt(false);
      return;
    }

    if (selectedPlatforms.size === 0) {
      setSearchError("Select at least one platform.");
      setSearchResults([]);
      setShowNavigationPrompt(false);
      return;
    }

    if (selectedLanguages.size === 0) {
      setSearchError("Select at least one language option.");
      setSearchResults([]);
      setShowNavigationPrompt(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setShowNavigationPrompt(false);

    try {
      const platformResponses = await Promise.all(
        Array.from(selectedPlatforms).map(async (platformId) => {
          const platformMeta = PLATFORM_OPTIONS.find((platform) => platform.id === platformId);
          if (!platformMeta) {
            throw new Error(`Unknown platform "${platformId}".`);
          }

          const response = await fetch(buildApiUrl("comments/search"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keywords: normalizedKeywords,
              source: platformId,
              limit: SEARCH_RESULTS_LIMIT,
              languages: Array.from(selectedLanguages),
            }),
          });

          const payload = (await response.json().catch(() => ({}))) as SearchResponse;

          if (!response.ok || payload.ok === false) {
            throw new Error(payload.error ?? `Unable to search ${platformMeta.label}.`);
          }

          const results = Array.isArray(payload.results) ? payload.results : [];

          return {
            platform: platformMeta.label,
            sourceTable: payload.sourceTable ?? platformId,
            results: results.map((result) => ({
              keyword: result.keyword ?? "",
              count: result.count ?? 0,
              comments: Array.isArray(result.comments)
                ? result.comments.slice(0, SEARCH_RESULTS_LIMIT)
                : [],
            })),
          };
        }),
      );

      setSearchResults(platformResponses);

      const preferencesToPersist: SavedPreferences = {
        keywords: normalizedKeywords,
        platforms: Array.from(selectedPlatforms),
        languages: Array.from(selectedLanguages),
        updatedAt: new Date().toISOString(),
      };

      await persistPreferencesToBackend(preferencesToPersist);
      savePreferencesToStorage(preferencesToPersist);

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
      setShowNavigationPrompt(true);
    } catch (error) {
      setSearchError((error as Error).message || "Search failed. Try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGoToPersonalMonitors = () => {
    setShowNavigationPrompt(false);
    navigate("/personal-monitors");
  };

  const handleStayOnDashboard = () => {
    setShowNavigationPrompt(false);
  };

  const handleExportKeywords = () => {
    if (!keywordInput.trim()) {
      setSearchError("No keywords to export. Enter some keywords first.");
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
      setSearchError("Please select a .txt file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setKeywordInput(content);
        setSearchError(null);
      }
    };
    reader.onerror = () => {
      setSearchError("Failed to read the file. Please try again.");
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
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
            onChange={(event) => setKeywordInput(event.target.value)}
            className="h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/30 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="e.g., name, location, event, activity, ID number, behaviour"
          />
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

        <section className="space-y-4">
          <header>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Platforms</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Choose the platforms to include in your search. Select any combination that fits your watch list.
            </p>
          </header>
          <div className="flex flex-wrap gap-3">
            {PLATFORM_OPTIONS.map((platform) => {
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
                  className={`flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 ${
                    isSelected
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            {lastSavedSettings ? (
              <span>
                Last saved search: {lastSavedSettings.keywords.join(", ")} • Platforms:{" "}
                {lastSavedSettings.platforms.join(", ")} • Languages: {lastSavedSettings.languages.join(", ")}
              </span>
            ) : (
              <span>Configure your keywords, platforms, and languages, then save to load matching posts.</span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stg-accent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSearching ? "Searching…" : "Save & Search"}
          </button>
        </div>

        {searchError && (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
            {searchError}
          </p>
        )}
      </form>

      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Search results</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Results are grouped by platform and keyword, prioritising the most recent posts.
          </p>
        </header>

        {isSearching && searchResults.length === 0 && (
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            Fetching posts from your selected sources…
          </div>
        )}

        {!isSearching && searchResults.length === 0 && !searchError && (
          <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/40 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
            Save your monitoring preferences to review the {SEARCH_RESULTS_LIMIT} latest matching posts here.
            Additional results are available on the Personal Monitors page.
          </div>
        )}

        <div className="space-y-5">
          {searchResults.map((platformResult) => (
            <article
              key={platformResult.sourceTable}
              className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70"
            >
              <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                    {platformResult.platform}
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Source: {platformResult.sourceTable}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Showing the {SEARCH_RESULTS_LIMIT} most recent posts per keyword. Review Personal Monitors for the full feed.
                </p>
              </header>

              {platformResult.results.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                  No posts matched the provided keywords on this platform.
                </p>
              ) : (
                <div className="space-y-4">
                  {platformResult.results.map((keywordResult) => (
                    <section key={`${platformResult.sourceTable}-${keywordResult.keyword}`} className="space-y-3">
                      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                          Keyword: {keywordResult.keyword || "Unknown"}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-300">
                          Matches: {keywordResult.count}
                        </span>
                      </header>
                      <div className="space-y-3">
                        {keywordResult.comments.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-300/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                            No recent posts contain this keyword.
                          </p>
                        ) : (
                          keywordResult.comments.map((comment, index) => (
                            <div
                              key={`${keywordResult.keyword}-${index}`}
                              className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <p>{comment.postText?.trim() || "No content provided."}</p>
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-300">
                                <span>Intent: {comment.predIntent ?? "Unknown"}</span>
                                <span>Posted: {comment.timeAgo ?? "Unspecified"}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {showNavigationPrompt && (
        <aside className="rounded-3xl border border-stg-accent/40 bg-stg-accent/10 p-6 text-sm text-slate-700 shadow-lg dark:border-stg-accent/30 dark:bg-stg-accent/20 dark:text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">
              Settings saved. Would you like to visit the Personal Monitors page to review these results?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoToPersonalMonitors}
                className="inline-flex items-center justify-center rounded-full bg-stg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60"
              >
                Go to Personal Monitors
              </button>
              <button
                type="button"
                onClick={handleStayOnDashboard}
                className="inline-flex items-center justify-center rounded-full border border-slate-300/70 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Stay on Dashboard
              </button>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
};

export default Dashboard;
