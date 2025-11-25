import { type MonitoredPost } from "@/types/monitors";

type LooseMonitoredPost = {
  [Key in keyof MonitoredPost]?: MonitoredPost[Key] | null;
};

export type BookmarkApiPayload = LooseMonitoredPost & {
  PROCESSED_ID?: string | null;
  processedId?: string | null;
  id?: string | null;
  SAVED_AT?: string | null;
  savedAt?: string | null;
  POST_DATA?: unknown;
  postData?: unknown;
};

const parseSerializedPost = (raw: unknown): LooseMonitoredPost | null => {
  if (!raw) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as LooseMonitoredPost;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    return raw as LooseMonitoredPost;
  }
  return null;
};

export const extractMonitoredPostFromBookmark = (bookmark: BookmarkApiPayload): MonitoredPost | null => {
  if (!bookmark) return null;

  const processedId = bookmark.PROCESSED_ID ?? bookmark.processedId ?? bookmark.id ?? null;
  const storedPost =
    parseSerializedPost(bookmark.postData) ??
    parseSerializedPost(bookmark.POST_DATA) ??
    parseSerializedPost(bookmark);

  if (!storedPost) {
    if (!processedId) return null;
    return {
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
    };
  }

  const resolvedId = storedPost.id ?? processedId;
  if (!resolvedId) return null;

  return {
    id: resolvedId,
    platform: storedPost.platform ?? bookmark.platform ?? "Unknown platform",
    sourceTable: storedPost.sourceTable ?? bookmark.sourceTable ?? "UNKNOWN",
    keyword: storedPost.keyword ?? bookmark.keyword ?? null,
    postText:
      storedPost.postText ??
      bookmark.postText ??
      "Post content not available. Click to view details.",
    predIntent: storedPost.predIntent ?? bookmark.predIntent ?? null,
    timeAgo: storedPost.timeAgo ?? bookmark.timeAgo ?? null,
    collectedAt:
      storedPost.collectedAt ??
      bookmark.collectedAt ??
      bookmark.SAVED_AT ??
      bookmark.savedAt ??
      new Date().toISOString(),
    postUrl: storedPost.postUrl ?? bookmark.postUrl ?? null,
    hateScore:
      typeof storedPost.hateScore === "number"
        ? storedPost.hateScore
        : typeof bookmark.hateScore === "number"
          ? bookmark.hateScore
          : null,
  };
};

