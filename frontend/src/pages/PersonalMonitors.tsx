import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Filter, Loader2, RefreshCcw, ShieldAlert, Send, Network, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type MonitoredPost, type SavedPreferences } from "@/types/monitors";
import { normalizePreferences } from "@/utils/preferences";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const POSTS_PER_PAGE = 10;

const PLATFORM_OPTIONS = [
  { id: "BLUSKY", label: "Bluesky" },
  { id: "MASTODON", label: "Mastodon" },
  { id: "TELEGRAM", label: "Telegram" },
];

// Map platform IDs to actual database table names
const PLATFORM_TO_TABLE_MAP: Record<string, string> = {
  BLUSKY: "BLUSKY_TEST",
  MASTODON: "MASTODON",
  TELEGRAM: "TELEGRAM",
};

const getTableNameForPlatform = (platformId: string): string => {
  return PLATFORM_TO_TABLE_MAP[platformId] || platformId;
};

type SearchResponse = {
  ok?: boolean;
  error?: string;
  results?: Array<{
    keyword?: string;
    count?: number;
    comments?: Array<{
      post_id?: string | null;
      postText?: string | null;
      predIntent?: string | null;
      timeAgo?: string | null;
      processedId?: string | null;
      collectedAt?: string | null;
      hateScore?: number | string | null;
      postUrl?: string | null;
    }>;
  }>;
  sourceTable?: string;
  platform?: string;
};

type PlatformIconFactory = () => JSX.Element;

const createLucideIconFactory =
  (Icon: LucideIcon): PlatformIconFactory =>
    () =>
      <Icon className="h-5 w-5" aria-hidden />;

const BlueskyIcon: PlatformIconFactory = () => (
  <img src="/Bluesky_Logo.svg" alt="" className="h-5 w-5 object-contain" aria-hidden />
);

const mastodonIcon = createLucideIconFactory(Network);
const telegramIcon = createLucideIconFactory(Send);
const shieldIcon = createLucideIconFactory(ShieldAlert);

const PLATFORM_ICON_MAP: Record<string, PlatformIconFactory> = {
  mastodon: mastodonIcon,
  "platform 1": mastodonIcon,
  bluesky: BlueskyIcon,
  blusky: BlueskyIcon,
  blusky_test: BlueskyIcon,
  "platform 2": BlueskyIcon,
  telegram: telegramIcon,
  "platform 3": telegramIcon,
};

const resolvePlatformIcon = (platform?: string | null) => {
  const normalized = platform?.trim().toLowerCase() ?? "";
  const factory = normalized ? PLATFORM_ICON_MAP[normalized] : undefined;
  const renderIcon = factory ?? shieldIcon;
  return renderIcon();
};

const PersonalMonitors = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [preferences, setPreferences] = useState<SavedPreferences | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  const [posts, setPosts] = useState<MonitoredPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const keywordsList = useMemo(() => preferences?.keywords ?? [], [preferences]);
  const languagesList = useMemo(() => preferences?.languages ?? [], [preferences]);
  const platformsList = useMemo(() => preferences?.platforms ?? [], [preferences]);

  // Posts are now always loaded from backend API, no localStorage cache

  useEffect(() => {
    if (!user?.id || !token) {
      setPreferences(null);
      setPreferencesError("You need to be signed in to load your monitoring preferences.");
      return;
    }

    const controller = new AbortController();
    setIsLoadingPreferences(true);
    setPreferencesError(null);

    const loadPreferences = async () => {
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

        // Check for 401 Unauthorized token expired
        if (response.status === 401) {
          logout();
          navigate("/login", {
            state: {
              from: { pathname: "/personal-monitors" },
              message: "Your session has expired. Please log in again."
            }
          });
          return;
        }

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load your saved settings right now.");
        }

        const normalized = normalizePreferences(payload.preferences) ?? {
          keywords: [],
          platforms: [],
          languages: [],
        };

        // Use default platforms if none are specified
        const resolvedPlatforms =
          normalized.platforms.length > 0
            ? normalized.platforms
            : PLATFORM_OPTIONS.map((platform) => platform.id);

        const mergedPreferences: SavedPreferences = {
          ...normalized,
          platforms: resolvedPlatforms,
        };

        setPreferences(mergedPreferences);
        setPreferencesError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        const errorMessage = (error as Error).message || "";
        if (errorMessage.includes("expired") || errorMessage.includes("Unauthorized")) {
          return;
        }

        setPreferences(null);
        setPreferencesError(
          (error as Error).message ??
          "We could not load your monitoring preferences. Configure them from the dashboard.",
        );
      } finally {
        setIsLoadingPreferences(false);
      }
    };

    void loadPreferences();

    return () => controller.abort();
  }, [token, user?.id, logout, navigate]);

  const fetchPosts = useCallback(async () => {
    if (!preferences) {
      setPosts([]);
      setPostsError("No monitoring preferences found. Save some keywords from the dashboard first.");
      return;
    }

    const trimmedKeywords = preferences.keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (trimmedKeywords.length === 0) {
      setPosts([]);
      setPostsError("No keywords configured. Update your dashboard settings to begin monitoring.");
      return;
    }

    const targetPlatforms =
      preferences.platforms && preferences.platforms.length > 0
        ? preferences.platforms
        : PLATFORM_OPTIONS.map((platform) => platform.id);

    setIsLoadingPosts(true);
    setPostsError(null);

    try {
      const platformResponses = await Promise.all(
        targetPlatforms.map(async (platformId) => {
          const platformMeta =
            PLATFORM_OPTIONS.find((platform) => platform.id === platformId) ?? {
              id: platformId,
              label: platformId,
            };

          const tableName = getTableNameForPlatform(platformId);
          const response = await fetch(buildApiUrl("comments/search"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              keywords: trimmedKeywords,
              source: tableName,
              limit: 50,
              languages: preferences.languages,
            }),
          });

          const payload = (await response.json().catch(() => ({}))) as SearchResponse;

          // Check for 401 Unauthorized
          if (response.status === 401) {
            logout();
            navigate("/login", {
              state: {
                from: { pathname: "/personal-monitors" },
                message: "Your session has expired. Please log in again."
              }
            });
            // Return empty result to prevent Promise.all from breaking
            return {
              platformId,
              platformLabel: platformMeta.label,
              sourceTable: platformId,
              keywordResults: [],
            };
          }

          if (!response.ok || payload.ok === false) {
            throw new Error(payload.error ?? `Unable to load posts from ${platformMeta.label}.`);
          }

          const keywordResults = Array.isArray(payload.results) ? payload.results : [];

          return {
            platformId,
            platformLabel: platformMeta.label,
            sourceTable: payload.sourceTable ?? platformId,
            keywordResults,
          };
        }),
      );

      const aggregated: MonitoredPost[] = [];
      let counter = 0;

      for (const platformResult of platformResponses) {
        const { platformLabel, sourceTable, keywordResults } = platformResult;

        for (const keywordResult of keywordResults) {
          const keywordValue = keywordResult.keyword ?? null;
          const comments = Array.isArray(keywordResult.comments) ? keywordResult.comments : [];

          for (const comment of comments) {
            // Use post_id from backend (actual database POST_ID) as the primary identifier
            // Fallback to processedId for backward compatibility
            const postId =
              (comment as { post_id?: string | null }).post_id?.toString().trim() ??
              (comment as { processedId?: string | null }).processedId?.toString().trim() ??
              null;

            // Skip posts without a valid post_id from backend
            if (!postId || postId.length === 0) {
              console.warn("Skipping post without post_id from backend:", comment);
              continue;
            }

            const parsedHateScore =
              typeof comment.hateScore === "number"
                ? comment.hateScore
                : typeof comment.hateScore === "string"
                  ? Number.parseFloat(comment.hateScore)
                  : null;
            const hateScore = Number.isFinite(parsedHateScore) ? parsedHateScore : null;
            const newPost: MonitoredPost = {
              id: postId,
              platform: platformLabel,
              sourceTable,
              keyword: keywordValue,
              postText: comment.postText?.trim() || "No content provided.",
              predIntent: comment.predIntent ?? null,
              timeAgo: comment.timeAgo ?? null,
              collectedAt:
                (comment as { collectedAt?: string | null }).collectedAt ??
                null,
              hateScore,
              postUrl: comment.postUrl ?? null,
            };
            aggregated.push(newPost);
            counter += 1;
          }
        }
      }

      const deduped: MonitoredPost[] = [];
      const seen = new Set<string>();

      for (const post of aggregated) {
        // Use post.id from backend
        if (!post.id) {
          console.warn("Skipping post without id during deduplication:", post);
          continue;
        }
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        deduped.push(post);
      }

      setPosts(deduped);
      setCurrentPage(1);
      setPostsError(deduped.length === 0 ? "No posts matched your current filters." : null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      setPostsError((error as Error).message || "Unable to load posts right now.");
      setPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [preferences, token, user?.id, logout, navigate]);

  useEffect(() => {
    if (!preferences) return;
    void fetchPosts();
  }, [fetchPosts, preferences]);

  const totalPages = useMemo(() => {
    if (posts.length === 0) return 1;
    return Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  }, [posts.length]);

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return posts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [currentPage, posts]);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handlePageSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPage = Number.parseInt(event.target.value, 10);
    if (selectedPage >= 1 && selectedPage <= totalPages) {
      setCurrentPage(selectedPage);
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const handleRefresh = () => {
    void fetchPosts();
  };

  if (!token) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-6 px-4 text-center">
        <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Sign in to manage monitors</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Personal Monitors aggregate threat intelligence based on your saved languages and keywords.
            Please log in to access your tailored feed.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login", { state: { from: { pathname: "/personal-monitors" } } })}
            className="mx-auto w-full rounded-full bg-stg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft"
          >
            Go to Login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
      <header className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Personal Monitors</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review posts that match your saved keywords, language and platform filters. Update preferences from the dashboard at any
          time to adjust this feed.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-slate-900/60">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Keywords: {keywordsList.length ? keywordsList.join(", ") : "None configured"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-slate-900/60">
            Platforms: {platformsList.length ? platformsList.join(", ") : "All"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-slate-900/60">
            Languages: {languagesList.length ? languagesList.join(", ") : "Any"}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingPreferences || isLoadingPosts}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 px-3 py-1.5 text-slate-700 transition hover:border-stg-accent hover:text-stg-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isLoadingPosts ? "animate-spin" : ""}`} aria-hidden />
            {isLoadingPosts ? "Refreshing…" : "Refresh feed"}
          </button>
        </div>

        {isLoadingPreferences && (
          <p className="mx-auto max-w-2xl rounded-3xl border border-slate-200/80 bg-white/70 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            Loading your saved monitoring preferences;-)
          </p>
        )}

        {preferencesError && (
          <p className="mx-auto max-w-2xl rounded-3xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100">
            {preferencesError}
          </p>
        )}
      </header>

      <div className="space-y-6">
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Matched posts</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Showing {paginatedPosts.length} of {posts.length} posts that align with your filters.
            </p>
          </div>
          {lastUpdatedAt && (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              Last refreshed {new Date(lastUpdatedAt).toLocaleString()}
            </span>
          )}
        </header>

        {isLoadingPosts && posts.length === 0 && (
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Fetching posts from your monitored sources;-)
          </div>
        )}

        {!isLoadingPosts && postsError && posts.length === 0 && (
          <div className="rounded-3xl border border-red-500/50 bg-red-500/15 p-6 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
            {postsError}
          </div>
        )}

        {!isLoadingPosts && !postsError && posts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/50 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300">
            No posts are currently matching your saved settings. Try widening your filters or checking back later.
          </div>
        )}

        <div className="grid gap-5">
          {paginatedPosts.map((post) => {
            const normalizedScore =
              typeof post.hateScore === "number" && Number.isFinite(post.hateScore)
                ? post.hateScore * 100
                : null;
            const formattedScore =
              normalizedScore !== null ? Math.round(normalizedScore).toString() : null;
            const platformIcon = resolvePlatformIcon(post.platform);

            return (
              <article
                key={post.id}
                className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition hover:border-stg-accent hover:shadow-lg dark:border-white/10 dark:bg-slate-900/70"
              >
                <Link
                  to={`/posts/${encodeURIComponent(post.id)}`}
                  state={{ post }}
                  className="flex flex-col gap-4"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white text-stg-accent dark:border-white/10 dark:bg-white/5">
                        {platformIcon}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-white">
                          {post.platform}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-300">
                          <span>Intent: {post.predIntent ?? "Unknown"}</span>
                          <span>Keyword: {post.keyword ?? "N/A"}</span>
                        </div>
                      </div>
                    </div>
                    {formattedScore !== null && (
                      <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest bg-red-500/10 text-red-600 dark:text-red-300">
                        score: {formattedScore}
                      </span>
                    )}
                  </header>
                  <p className="line-clamp-5 text-sm text-slate-700 transition group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">
                    {post.postText}
                  </p>
                </Link>
                <footer className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="block h-2 w-2 rounded-full bg-stg-accent" aria-hidden />
                    Updated {post.timeAgo ?? "Unspecified"}
                  </span>
                  {post.postUrl ? (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold uppercase tracking-wide text-stg-accent transition hover:text-slate-900 dark:hover:text-white"
                    >
                      Original link
                    </a>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Original link unavailable
                    </span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>

        {posts.length > POSTS_PER_PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white/95 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-200/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:border-stg-accent hover:text-stg-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
              >
                Previous page
              </button>
              <select
                value={currentPage}
                onChange={handlePageSelect}
                className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/30 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Select page"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="rounded-full border border-slate-200/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:border-stg-accent hover:text-stg-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
              >
                Next page
              </button>
            </div>
          </div>
        )}

        {posts.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-300">
            This page shows the first {POSTS_PER_PAGE} posts. Use the NEXT PAGE button to load more, or click a post to
            find details, leave comments, or add it to your bookmarks.
          </p>
        )}
      </div>
    </section>
  );
};

export default PersonalMonitors;
