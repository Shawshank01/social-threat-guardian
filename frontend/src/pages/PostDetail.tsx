import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, BookmarkCheck, MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type MonitoredPost, type PostComment } from "@/types/monitors";
import { loadPostsFromStorage } from "@/utils/monitoringStorage";

type LocationState = {
  post?: MonitoredPost;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const formatTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const PostDetail = () => {
  const { postId: encodedPostId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();

  const postFromState = (location.state as LocationState | null)?.post;
  const decodedPostId = useMemo(() => {
    try {
      return encodedPostId ? decodeURIComponent(encodedPostId) : null;
    } catch {
      return encodedPostId ?? null;
    }
  }, [encodedPostId]);

  const [post, setPost] = useState<MonitoredPost | null>(postFromState ?? null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);

  useEffect(() => {
    if (post || !decodedPostId) return;
    const storedPosts = loadPostsFromStorage(user?.id);
    const matchedPost = storedPosts.find((stored) => stored.id === decodedPostId) ?? null;
    setPost(matchedPost);
  }, [decodedPostId, post, user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!decodedPostId || !userId || !token) return;
    const controller = new AbortController();

    const loadFavorite = async () => {
      try {
        // GET /bookmark to list all bookmarks, then check if this post is bookmarked
        const response = await fetch(buildApiUrl("favorites"), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 404) {
          setIsFavorite(false);
          setFavoriteError(null);
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          bookmarks?: Array<{
            BOOKMARK_ID?: string;
            USER_ID?: string;
            PROCESSED_ID?: string;
            SAVED_AT?: string;
            UPDATED_AT?: string;
          }>;
          error?: string;
        };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load bookmark status.");
        }

        // Check if this post is in the bookmarks list
        const isBookmarked = payload.bookmarks?.some(
          (bookmark) => bookmark.PROCESSED_ID === decodedPostId
        ) ?? false;

        setIsFavorite(isBookmarked);
        setFavoriteError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setFavoriteError((error as Error).message || "Unable to load bookmark status.");
      }
    };

    void loadFavorite();

    return () => controller.abort();
  }, [decodedPostId, user?.id, token]);

  useEffect(() => {
    if (!decodedPostId) return;

    const controller = new AbortController();
    setIsLoadingComments(true);
    setCommentsError(null);

    const loadComments = async () => {
      try {
        const response = await fetch(
          buildApiUrl(`comments/${encodeURIComponent(decodedPostId)}/notes`),
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          comments?: Array<{
            id?: string;
            userId?: string;
            authorName?: string | null;
            commentText?: string | null;
            createdAt?: string | null;
          }>;
          error?: string;
        };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load comments.");
        }

        const mapped: PostComment[] = (payload.comments ?? []).map((comment) => ({
          id: comment.id ?? `${decodedPostId}-${Math.random().toString(36).slice(2)}`,
          author: comment.authorName && comment.authorName.trim().length > 0 ? comment.authorName : "Analyst",
          text: comment.commentText ?? "",
          createdAt: comment.createdAt ?? new Date().toISOString(),
        }));

        setComments(mapped);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setCommentsError((error as Error).message || "Unable to load comments.");
        setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    };

    void loadComments();

    return () => controller.abort();
  }, [decodedPostId]);

  if (!decodedPostId || !post) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-4xl flex-col justify-center gap-6 px-4 text-center">
        <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Post not found</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Could not locate the post you requested. It may have expired or your monitoring filters have changed.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/personal-monitors"
              className="inline-flex items-center gap-2 rounded-full bg-stg-accent px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Personal Monitors
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const handleToggleFavorite = async () => {
    if (!token) {
      setFavoriteError("You need an authenticated session to manage bookmarks.");
      return;
    }

    setIsUpdatingFavorite(true);
    setFavoriteError(null);

    try {
      if (isFavorite) {
        // DELETE /bookmark/remove
        const response = await fetch(
          buildApiUrl(`favorites/${encodeURIComponent(post.id)}`),
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ post_id: post.id }),
          },
        );

        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to remove from bookmarks.");
        }

        setIsFavorite(false);
      } else {
        // POST /bookmark/add
        const response = await fetch(buildApiUrl("favorites"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            post_id: post.id,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to save to bookmarks.");
        }

        setIsFavorite(true);
      }
    } catch (error) {
      setFavoriteError((error as Error).message || "Unable to update bookmark status.");
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  const [isPostingComment, setIsPostingComment] = useState(false);

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed) return;

    const userId = user?.id;
    if (!userId) {
      setCommentsError("You need an authenticated session to add comments.");
      return;
    }

    setIsPostingComment(true);
    setCommentsError(null);

    try {
      const response = await fetch(
        buildApiUrl(`comments/${encodeURIComponent(post.id)}/notes`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId,
            author: user?.name?.trim() ?? null,
            commentText: trimmed,
          }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        comment?: {
          id?: string;
          authorName?: string | null;
          commentText?: string | null;
          createdAt?: string | null;
        } | null;
        error?: string;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "Unable to save your comment.");
      }

      const savedComment = payload.comment;
      const mapped: PostComment = {
        id: savedComment?.id ?? `${post.id}-${Date.now()}`,
        author:
          savedComment?.authorName && savedComment.authorName.trim().length > 0
            ? savedComment.authorName
            : user?.name?.trim() || "Analyst",
        text: savedComment?.commentText ?? trimmed,
        createdAt: savedComment?.createdAt ?? new Date().toISOString(),
      };

      setComments((prev) => [...prev, mapped]);
      setCommentInput("");
    } catch (error) {
      setCommentsError((error as Error).message || "Unable to save your comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back
          </button>
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={isUpdatingFavorite}
            className="inline-flex items-center gap-2 rounded-full border border-stg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-stg-accent/70 dark:text-stg-accent/90"
          >
            {isFavorite ? (
              <>
                <BookmarkCheck className="h-4 w-4" aria-hidden />
                In bookmarks
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" aria-hidden />
                Add to bookmarks
              </>
            )}
          </button>
        </div>
        {favoriteError && (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
            {favoriteError}
          </p>
        )}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {post.platform} • Source table: {post.sourceTable}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Post review</h1>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-300">
            <span>Intent: {post.predIntent ?? "Unknown"}</span>
            <span className="inline-flex items-center gap-1">
              <span className="block h-2 w-2 rounded-full bg-stg-accent" aria-hidden />
              Updated {post.timeAgo ?? "Unspecified"}
            </span>
            {post.keyword && <span>Matched keyword: {post.keyword}</span>}
            {post.collectedAt && <span>Collected: {formatTimestamp(post.collectedAt)}</span>}
          </div>
        </div>
      </header>

      <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-sm leading-relaxed text-slate-800 shadow-soft dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">
        <p className="mb-4">{post.postText}</p>
        <footer className="flex items-center justify-end border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
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

      <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/70">
        <header className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-stg-accent" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Internal comments</h2>
        </header>

        {isLoadingComments ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
            Loading comments…
          </p>
        ) : commentsError ? (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/15 p-4 text-xs font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
            {commentsError}
          </p>
        ) : comments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300/70 p-4 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
            No comments yet. Use this space to leave follow-up notes.
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">{comment.author}</span>
                  <span>{formatTimestamp(comment.createdAt)}</span>
                </div>
                <p>{comment.text}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmitComment} className="space-y-3">
          <textarea
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            className="min-h-[6rem] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-stg-accent focus:outline-none focus:ring-2 focus:ring-stg-accent/30 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="Add a new comment..."
          />
          <button
            type="submit"
            disabled={isPostingComment}
            className="inline-flex items-center gap-2 rounded-full bg-stg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft"
          >
            {isPostingComment ? "Saving…" : "Submit comment"}
          </button>
        </form>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <Link
          to="/personal-monitors"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 px-4 py-2 transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Return to monitoring feed
        </Link>
        <Link
          to="/bookmarks"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 px-4 py-2 transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
        >
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          View bookmarks
        </Link>
      </footer>
    </section>
  );
};

export default PostDetail;
