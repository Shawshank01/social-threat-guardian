import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type MonitoredPost } from "@/types/monitors";
import { extractMonitoredPostFromBookmark } from "@/utils/bookmarkData";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

type FavoriteRow = {
  userId?: string;
  processedId?: string;
  platform?: string | null;
  sourceTable?: string | null;
  keyword?: string | null;
  postText?: string | null;
  predIntent?: string | null;
  timeAgo?: string | null;
  collectedAt?: string | null;
  savedAt?: string | null;
  postUrl?: string | null;
  hateScore?: number | null;
};

type BookmarkApiRow = FavoriteRow & {
  BOOKMARK_ID?: string;
  USER_ID?: string;
  PROCESSED_ID?: string;
  SAVED_AT?: string;
  UPDATED_AT?: string;
  POST_DATA?: unknown;
  postData?: unknown;
};

const fallbackPostFromBookmark = (bookmark: BookmarkApiRow, processedId: string): MonitoredPost => ({
  id: processedId,
  platform: bookmark.platform ?? "Unknown platform",
  sourceTable: bookmark.sourceTable ?? "UNKNOWN",
  keyword: bookmark.keyword ?? null,
  postText: bookmark.postText ?? "Post content not available. Click to view details.",
  predIntent: bookmark.predIntent ?? null,
  timeAgo: bookmark.timeAgo ?? null,
  collectedAt: bookmark.collectedAt ?? bookmark.SAVED_AT ?? bookmark.savedAt ?? new Date().toISOString(),
  postUrl: bookmark.postUrl ?? null,
  hateScore: bookmark.hateScore ?? null,
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
      // First, get the list of bookmarks to get the post IDs
      const bookmarksResponse = await fetch(buildApiUrl("favorites"), {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const bookmarksPayload = (await bookmarksResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        bookmarks?: BookmarkApiRow[];
        favorites?: BookmarkApiRow[]; // Legacy support
        error?: string;
      };

      if (!bookmarksResponse.ok || bookmarksPayload.ok === false) {
        throw new Error(bookmarksPayload.error ?? "Unable to load bookmarks.");
      }

      const bookmarkList = bookmarksPayload.bookmarks || bookmarksPayload.favorites || [];
      if (bookmarkList.length === 0) {
        setBookmarks([]);
        return;
      }

      // Try to fetch post data from /bookmark/content endpoint with common source tables
      // Try BLUSKY_TEST first (default), then try other common tables
      const sourceTables = ["BLUSKY_TEST", "BLUSKY", "BLUSKY2"];
      let mappedPosts: MonitoredPost[] = [];

      for (const sourceTable of sourceTables) {
        try {
          const contentResponse = await fetch(
            buildApiUrl(`favorites/content?source=${encodeURIComponent(sourceTable)}`),
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            },
          );

          const contentPayload = (await contentResponse.json().catch(() => ({}))) as {
            ok?: boolean;
            posts?: Array<{
              postId?: string;
              postUrl?: string | null;
              postText?: string | null;
              postTimestamp?: string | null;
              savedAt?: string | null;
              bookmarkId?: string;
            }>;
            source?: string;
            error?: string;
          };

          if (contentResponse.ok && contentPayload.ok && contentPayload.posts) {
            // Use flexible matching to handle different ID formats
            const bookmarkMap = new Map(
              bookmarkList.map((bm) => {
                const id = bm.PROCESSED_ID || (bm as FavoriteRow).processedId || "";
                return [id, bm];
              }),
            );

            // Map posts from content endpoint to MonitoredPost format
            mappedPosts = contentPayload.posts
              .map((post) => {
                if (!post.postId) return null;

                // Try to find matching bookmark using flexible matching
                let bookmark: BookmarkApiRow | FavoriteRow | undefined;
                
                // Try exact match first
                bookmark = bookmarkMap.get(post.postId);
                
                // If not found, try case-insensitive match
                if (!bookmark) {
                  for (const [bookmarkId, bm] of bookmarkMap.entries()) {
                    if (bookmarkId.toLowerCase() === post.postId.toLowerCase()) {
                      bookmark = bm;
                      break;
                    }
                  }
                }
                
                // If still not found and post ID is an AT URI, try partial matching
                if (!bookmark && post.postId.includes("/app.bsky.feed.post/")) {
                  const postIdPart = post.postId.split("/app.bsky.feed.post/")[1];
                  if (postIdPart) {
                    for (const [bookmarkId, bm] of bookmarkMap.entries()) {
                      if (bookmarkId.includes(postIdPart) || bookmarkId.includes("/app.bsky.feed.post/")) {
                        const bookmarkIdPart = bookmarkId.split("/app.bsky.feed.post/")[1];
                        if (bookmarkIdPart === postIdPart) {
                          bookmark = bm;
                          break;
                        }
                      }
                    }
                  }
                }
                
                // Also try matching by POST_URL if available
                if (!bookmark && post.postUrl) {
                  for (const [bookmarkId, bm] of bookmarkMap.entries()) {
                    if (bookmarkId.includes("/app.bsky.feed.post/") && post.postUrl?.includes(bookmarkId)) {
                      bookmark = bm;
                      break;
                    }
                  }
                }

                if (!bookmark) return null;

                const processedId = post.postId;
                const platformLabel = sourceTable === "BLUSKY_TEST" || sourceTable === "BLUSKY" || sourceTable === "BLUSKY2"
                  ? "Bluesky"
                  : sourceTable;

                return {
                  id: processedId,
                  platform: platformLabel,
                  sourceTable: contentPayload.source || sourceTable,
                  keyword: null,
                  postText: post.postText || "Post content not available. Click to view details.",
                  predIntent: null,
                  timeAgo: post.postTimestamp
                    ? formatTimeAgo(new Date(post.postTimestamp))
                    : null,
                  collectedAt: post.postTimestamp || null,
                  postUrl: post.postUrl || null,
                  hateScore: null,
                } as MonitoredPost;
              })
              .filter((post): post is MonitoredPost => post !== null);

            // If we found posts, break and use this result
            if (mappedPosts.length > 0) {
              break;
            }
          }
        } catch {
          // Continue to next source table
          continue;
        }
      }

      // If we didn't find posts from content endpoint, try searching the database
      // using user preferences (same method as Personal Monitors)
      if (mappedPosts.length === 0 && bookmarkList.length > 0) {
        // Load user preferences to search the database
        try {
          const preferencesResponse = await fetch(buildApiUrl("user-preferences"), {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          let keywords: string[] = [];
          let platforms: string[] = ["BLUSKY", "BLUSKY_TEST", "BLUSKY2"];
          let languages: string[] = [];

          if (preferencesResponse.ok) {
            const preferencesPayload = (await preferencesResponse.json().catch(() => ({}))) as {
              ok?: boolean;
              preferences?: {
                keywords?: string[];
                platforms?: string[];
                languages?: string[];
              };
            };

            if (preferencesPayload.ok && preferencesPayload.preferences) {
              keywords = preferencesPayload.preferences.keywords || [];
              platforms = preferencesPayload.preferences.platforms && preferencesPayload.preferences.platforms.length > 0
                ? preferencesPayload.preferences.platforms
                : ["BLUSKY", "BLUSKY_TEST", "BLUSKY2"];
              languages = preferencesPayload.preferences.languages || [];
            }
          }

          // If we have keywords, search the database for all bookmarked post IDs
          if (keywords.length > 0) {
            const postIdsToFind = bookmarkList
              .map((bm) => bm.PROCESSED_ID || (bm as FavoriteRow).processedId)
              .filter((id): id is string => !!id && typeof id === "string");

            // Search each platform for the bookmarked posts
            const searchPromises = platforms.map(async (platformId) => {
              try {
                const response = await fetch(buildApiUrl("comments/search"), {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    keywords: keywords,
                    source: platformId,
                    limit: 200, // Search more posts to find all bookmarked ones
                    languages: languages.length > 0 ? languages : undefined,
                  }),
                });

                const payload = (await response.json().catch(() => ({}))) as {
                  ok?: boolean;
                  results?: Array<{
                    keyword?: string;
                    comments?: Array<{
                      post_id?: string | null;
                      postText?: string | null;
                      predIntent?: string | null;
                      timeAgo?: string | null;
                      collectedAt?: string | null;
                      hateScore?: number | string | null;
                      postUrl?: string | null;
                    }>;
                  }>;
                  sourceTable?: string;
                  platform?: string;
                };

                if (!response.ok || payload.ok === false) {
                  return [];
                }

                // Find all bookmarked posts in the search results
                const foundPosts: MonitoredPost[] = [];
                const results = payload.results || [];
                
                for (const result of results) {
                  const comments = result.comments || [];
                  for (const comment of comments) {
                    const postId = comment.post_id?.toString().trim() || null;
                    if (!postId) continue;

                    // Check if this post is in our bookmarked list
                    const isBookmarked = postIdsToFind.some((bookmarkedId) => {
                      if (postId === bookmarkedId) return true;
                      if (postId.toLowerCase() === bookmarkedId.toLowerCase()) return true;
                      // For AT URIs, try partial matching
                      if (bookmarkedId.includes("/app.bsky.feed.post/")) {
                        const postIdPart = bookmarkedId.split("/app.bsky.feed.post/")[1];
                        if (postIdPart && (postId.includes(postIdPart) || comment.postUrl?.includes(postIdPart))) {
                          return true;
                        }
                        if (comment.postUrl?.includes(bookmarkedId) || bookmarkedId.includes(comment.postUrl || "")) {
                          return true;
                        }
                      }
                      return false;
                    });

                    if (isBookmarked) {
                      const platformLabel = platformId === "BLUSKY_TEST" || platformId === "BLUSKY" || platformId === "BLUSKY2"
                        ? "Bluesky"
                        : platformId;

                      foundPosts.push({
                        id: postId,
                        platform: platformLabel,
                        sourceTable: payload.sourceTable || platformId,
                        keyword: result.keyword ?? null,
                        postText: comment.postText || "Post content not available. Click to view details.",
                        predIntent: comment.predIntent ?? null,
                        timeAgo: comment.timeAgo || null,
                        collectedAt: comment.collectedAt || null,
                        postUrl: comment.postUrl || null,
                        hateScore: typeof comment.hateScore === "number"
                          ? comment.hateScore
                          : typeof comment.hateScore === "string"
                            ? Number.parseFloat(comment.hateScore)
                            : null,
                      });
                    }
                  }
                }

                return foundPosts;
              } catch {
                return [];
              }
            });

            const searchResults = await Promise.all(searchPromises);
            const allFoundPosts = searchResults.flat();

            // Deduplicate by post ID
            const postMap = new Map<string, MonitoredPost>();
            for (const foundPost of allFoundPosts) {
              if (!postMap.has(foundPost.id)) {
                postMap.set(foundPost.id, foundPost);
              }
            }

            mappedPosts = Array.from(postMap.values());
          }
        } catch (err) {
          console.error("Failed to search database for bookmarked posts:", err);
        }
      }

      // If still no posts found, fall back to bookmark metadata
      if (mappedPosts.length === 0) {
        mappedPosts = bookmarkList
          .map((bookmark) => {
            const processedId =
              "PROCESSED_ID" in bookmark
                ? bookmark.PROCESSED_ID
                : (bookmark as FavoriteRow).processedId;
            if (!processedId) return null;

            const postData = extractMonitoredPostFromBookmark({
              ...(bookmark as BookmarkApiRow),
              PROCESSED_ID: processedId,
            });

            if (postData) {
              return postData;
            }

            // Fallback: create minimal post data from bookmark metadata
            return fallbackPostFromBookmark(bookmark as BookmarkApiRow, processedId);
          })
          .filter((post): post is MonitoredPost => post !== null);
      }

      setBookmarks(mappedPosts);
    } catch (err) {
      setError((err as Error).message || "Unable to load bookmarks right now.");
      setBookmarks([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.id]);

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

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
