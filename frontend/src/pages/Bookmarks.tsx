import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type MonitoredPost } from "@/types/monitors";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

type BookmarkApiRow = {
  BOOKMARK_ID: string;
  USER_ID: string;
  PROCESSED_ID: string;
  SAVED_AT: string;
  UPDATED_AT: string;
};

type BookmarkContentPost = {
  postId: string;
  postUrl: string | null;
  postText: string | null;
  postTimestamp: string | null;
  savedAt: string | null;
  bookmarkId: string;
};

const Bookmarks = () => {
  const { user, token } = useAuth();
  const [bookmarks, setBookmarks] = useState<MonitoredPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !token) {
      setBookmarks([]);
      setError("You need to be signed in to access bookmarks.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get list of bookmarks (GET /bookmark)
      const bookmarksResponse = await fetch(buildApiUrl("favorites"), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const bookmarksPayload = (await bookmarksResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        count?: number;
        bookmarks?: BookmarkApiRow[];
        error?: string;
      };

      if (!bookmarksResponse.ok || bookmarksPayload.ok === false) {
        throw new Error(bookmarksPayload.error ?? "Unable to load bookmarks.");
      }

      const bookmarkList = bookmarksPayload.bookmarks || [];
      if (bookmarkList.length === 0) {
        setBookmarks([]);
        return;
      }

      // Debug: Log bookmarks to see what we got
      console.log("[Bookmarks] Loaded bookmarks:", bookmarkList);
      console.log("[Bookmarks] PROCESSED_ID values:", bookmarkList.map((bm) => bm.PROCESSED_ID));

      // Step 2: Get post content from /bookmark/content for each source table
      // Try common source tables: BLUSKY_TEST, BLUSKY, BLUSKY2
      const sourceTables = ["BLUSKY_TEST", "BLUSKY", "BLUSKY2"];
      const allPosts = new Map<string, MonitoredPost>();

      // Create a map of bookmarks by PROCESSED_ID for exact matching
      const bookmarkMap = new Map<string, BookmarkApiRow>();
      for (const bookmark of bookmarkList) {
        bookmarkMap.set(bookmark.PROCESSED_ID, bookmark);
      }

      // Fetch content from each source table
      for (const sourceTable of sourceTables) {
        try {
          const contentResponse = await fetch(
            buildApiUrl(`favorites/content?source=${encodeURIComponent(sourceTable)}`),
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const contentPayload = (await contentResponse.json().catch(() => ({}))) as {
            ok?: boolean;
            count?: number;
            source?: string;
            posts?: BookmarkContentPost[];
            error?: string;
          };

          if (!contentResponse.ok || contentPayload.ok === false) {
            // Continue to next source table if this one fails
            continue;
          }

          const posts = contentPayload.posts || [];
          const source = contentPayload.source || sourceTable;

          // Debug: Log what we got from content endpoint
          console.log(`[Bookmarks] Content from ${sourceTable}:`, {
            count: posts.length,
            posts: posts.map((p) => ({ postId: p.postId, hasText: !!p.postText })),
            postIds: posts.map((p) => p.postId),
          });

          // Match posts to bookmarks by exact PROCESSED_ID match (as backend does)
          for (const post of posts) {
            // Backend returns postId which should match PROCESSED_ID exactly
            const bookmark = bookmarkMap.get(post.postId);
            if (!bookmark) {
              // Skip if no matching bookmark found
              continue;
            }

            // Only add posts that have content and haven't been added yet
            if (post.postText && post.postText.trim() && !allPosts.has(bookmark.PROCESSED_ID)) {
              const platformLabel =
                source === "BLUSKY_TEST" || source === "BLUSKY" || source === "BLUSKY2"
                  ? "Bluesky"
                  : source;

              // Format time ago from postTimestamp
              let timeAgo: string | null = null;
              if (post.postTimestamp) {
                const postDate = new Date(post.postTimestamp);
                const now = new Date();
                const diffMs = now.getTime() - postDate.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) {
                  timeAgo = "just now";
                } else if (diffMins < 60) {
                  timeAgo = `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
                } else if (diffHours < 24) {
                  timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
                } else {
                  timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
                }
              }

              allPosts.set(bookmark.PROCESSED_ID, {
                id: bookmark.PROCESSED_ID,
                platform: platformLabel,
                sourceTable: source,
                keyword: null,
                postText: post.postText.trim(),
                predIntent: null,
                timeAgo,
                collectedAt: post.postTimestamp || null,
                postUrl: post.postUrl || null,
                hateScore: null,
              });
            }
          }
        } catch {
          // Continue to next source table if this one fails
          continue;
        }
      }

      // Convert map to array, preserving bookmark order
      const mappedPosts: MonitoredPost[] = [];
      for (const bookmark of bookmarkList) {
        const post = allPosts.get(bookmark.PROCESSED_ID);
        if (post) {
          mappedPosts.push(post);
        } else {
          // Debug: Log bookmarks that didn't get matched
          console.log(`[Bookmarks] No post found for bookmark:`, {
            PROCESSED_ID: bookmark.PROCESSED_ID,
            BOOKMARK_ID: bookmark.BOOKMARK_ID,
          });
        }
      }

      // Debug: Log final result
      console.log(`[Bookmarks] Final mapped posts: ${mappedPosts.length} out of ${bookmarkList.length} bookmarks`);

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
      // DELETE /bookmark/remove
      // Use query parameter to avoid Vercel dynamic route issues with DELETE
      const response = await fetch(buildApiUrl(`favorites?post_id=${encodeURIComponent(processedId)}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        removed?: number;
        error?: string;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to remove bookmark.");
      }

      // Remove from local state
      setBookmarks((prev) => prev.filter((post) => post.id !== processedId));
    } catch (err) {
      setError((err as Error).message || "Unable to remove bookmark.");
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
