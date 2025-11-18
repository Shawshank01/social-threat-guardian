import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type MonitoredPost } from "@/types/monitors";
import { loadPostsFromStorage } from "@/utils/monitoringStorage";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

type FavoriteRow = {
  userId: string;
  processedId: string;
  platform?: string | null;
  sourceTable?: string | null;
  keyword?: string | null;
  postText?: string | null;
  predIntent?: string | null;
  timeAgo?: string | null;
  collectedAt?: string | null;
  savedAt?: string | null;
};

const mapFavoriteToPost = (favorite: FavoriteRow): MonitoredPost => ({
  id: favorite.processedId,
  platform: favorite.platform ?? "Unknown platform",
  sourceTable: favorite.sourceTable ?? "UNKNOWN",
  keyword: favorite.keyword ?? null,
  postText: favorite.postText ?? "No content provided.",
  predIntent: favorite.predIntent ?? null,
  timeAgo: favorite.timeAgo ?? null,
  collectedAt: favorite.collectedAt ?? favorite.savedAt ?? new Date().toISOString(),
});

const Bookmarks = () => {
  const { user, token } = useAuth();
  const [bookmarks, setBookmarks] = useState<MonitoredPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setBookmarks([]);
      setError("You need to be signed in to access bookmarks.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl("favorites"), {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        bookmarks?: Array<{
          BOOKMARK_ID?: string;
          USER_ID?: string;
          PROCESSED_ID?: string;
          SAVED_AT?: string;
          UPDATED_AT?: string;
        }>;
        favorites?: FavoriteRow[]; // Legacy support
        error?: string;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to load bookmarks.");
      }

      // Backend returns bookmarks array with PROCESSED_ID only
      const bookmarkList = payload.bookmarks || payload.favorites || [];
      
      // Try to load post details from local storage first
      const storedPosts = loadPostsFromStorage(userId);
      
      // Map bookmarks to posts, using stored post data if available
      const mappedPosts: MonitoredPost[] = bookmarkList
        .map((bookmark) => {
          // Handle both new backend format (with PROCESSED_ID) and legacy format (with processedId)
          const processedId =
            "PROCESSED_ID" in bookmark
              ? bookmark.PROCESSED_ID
              : (bookmark as FavoriteRow).processedId;
          if (!processedId) return null;

          // Try to find the post in stored posts
          const storedPost = storedPosts.find((p: MonitoredPost) => p.id === processedId);

          if (storedPost) {
            // Use stored post data
            return storedPost;
          }

          // Fallback: create minimal post data from bookmark
          // The user can click to view details which will load from storage or fetch
          const savedAt = "SAVED_AT" in bookmark ? bookmark.SAVED_AT : (bookmark as FavoriteRow).savedAt;
          return {
            id: processedId,
            platform: (bookmark as FavoriteRow).platform ?? "Unknown platform",
            sourceTable: (bookmark as FavoriteRow).sourceTable ?? "UNKNOWN",
            keyword: (bookmark as FavoriteRow).keyword ?? null,
            postText: (bookmark as FavoriteRow).postText ?? "Post content not available. Click to view details.",
            predIntent: (bookmark as FavoriteRow).predIntent ?? null,
            timeAgo: (bookmark as FavoriteRow).timeAgo ?? null,
            collectedAt: (bookmark as FavoriteRow).collectedAt ?? savedAt ?? new Date().toISOString(),
          };
        })
        .filter((post): post is MonitoredPost => post !== null);
      
      setBookmarks(mappedPosts);
    } catch (err) {
      setError((err as Error).message || "Unable to load bookmarks right now.");
      setBookmarks([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  const total = useMemo(() => bookmarks.length, [bookmarks]);

  const handleRemove = async (processedId: string) => {
    if (!token) return;
    try {
      const response = await fetch(
        buildApiUrl(`favorites/${encodeURIComponent(processedId)}`),
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ post_id: processedId }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to remove bookmark.");
      }

      setBookmarks((prev) => prev.filter((post) => post.id !== processedId));
    } catch (err) {
      setError((err as Error).message || "Unable to update bookmarks.");
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12">
      <header className="space-y-3">
        <div className="flex items-center gap-3 text-stg-accent">
          <Bookmark className="h-5 w-5" aria-hidden />
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Bookmarks</h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Saved posts are stored in your monitoring workspace. Click a post to revisit its details or remove it from your
          list at any time.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
          <span>Total saved posts: {total}</span>
          <button
            type="button"
            onClick={() => loadBookmarks()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1.5 transition hover:border-stg-accent hover:text-stg-accent disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Refresh
          </button>
        </div>
        {error && (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
            {error}
          </p>
        )}
      </header>

      {isLoading && bookmarks.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200/80 bg-white/95 p-8 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading your bookmarks…
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/50 p-8 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300">
          You have not added any posts to your bookmarks yet. Open a post from the Personal Monitors feed to save it
          here for follow-up.
        </div>
      ) : (
        <div className="grid gap-5">
          {bookmarks.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition hover:border-stg-accent hover:shadow-lg dark:border-white/10 dark:bg-slate-900/70"
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  {post.platform} • Source: {post.sourceTable}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  {post.keyword && <span>Keyword: {post.keyword}</span>}
                  {post.predIntent && <span>Intent: {post.predIntent}</span>}
                </div>
              </header>

              <p className="line-clamp-5 text-sm text-slate-700 dark:text-slate-200">{post.postText}</p>

              <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
                <Link
                  to={`/posts/${encodeURIComponent(post.id)}`}
                  state={{ post }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
                >
                  View post
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(post.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-red-500/70 px-4 py-2 text-red-600 transition hover:bg-red-500/10 dark:border-red-400/60 dark:text-red-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default Bookmarks;
