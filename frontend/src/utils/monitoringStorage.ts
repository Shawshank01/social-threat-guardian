import { type MonitoredPost, type PostComment, type SavedPreferences } from "@/types/monitors";

const PREFERENCES_KEY = "stg.dashboard.preferences";
const POSTS_KEY = "stg.personalMonitors.posts";
const COMMENTS_KEY = "stg.personalMonitors.comments";

const getScopedKey = (baseKey: string, userId?: string | number | null) => {
  if (userId === undefined || userId === null || String(userId).trim() === "") {
    return `${baseKey}.anonymous`;
  }
  return `${baseKey}.${String(userId).trim()}`;
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

export const normalizePreferences = (raw: unknown): SavedPreferences | null => {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const keywords = isStringArray(record.keywords) ? record.keywords : [];
  const platforms = isStringArray(record.platforms) ? record.platforms : [];
  const languages = isStringArray(record.languages) ? record.languages : [];

  const preferences: SavedPreferences = {
    keywords,
    platforms,
    languages,
  };

  if (typeof record.updatedAt === "string") {
    preferences.updatedAt = record.updatedAt;
  }

  return preferences;
};

export const loadPreferencesFromStorage = (): SavedPreferences | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed);
  } catch {
    return null;
  }
};

export const savePreferencesToStorage = (preferences: SavedPreferences) => {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      keywords: preferences.keywords,
      platforms: preferences.platforms,
      languages: preferences.languages,
      updatedAt: preferences.updatedAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; local cache is optional.
  }
};

export const savePostsToStorage = (posts: MonitoredPost[], userId?: string | number | null) => {
  if (typeof window === "undefined") return;
  try {
    const scopedKey = getScopedKey(POSTS_KEY, userId);
    window.localStorage.setItem(scopedKey, JSON.stringify(posts));
  } catch {
    // Ignore storage failures; posts can be refetched.
  }
};

export const loadPostsFromStorage = (userId?: string | number | null): MonitoredPost[] => {
  if (typeof window === "undefined") return [];
  try {
    const scopedKey = getScopedKey(POSTS_KEY, userId);
    const raw = window.localStorage.getItem(scopedKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonitoredPost[]) : [];
  } catch {
    return [];
  }
};

export const loadCommentsForPost = (
  postId: string,
  userId?: string | number | null,
): PostComment[] => {
  if (typeof window === "undefined") return [];
  try {
    const scopedKey = getScopedKey(`${COMMENTS_KEY}.${postId}`, userId);
    const raw = window.localStorage.getItem(scopedKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PostComment[]) : [];
  } catch {
    return [];
  }
};

export const saveCommentsForPost = (
  postId: string,
  comments: PostComment[],
  userId?: string | number | null,
) => {
  if (typeof window === "undefined") return;
  try {
    const scopedKey = getScopedKey(`${COMMENTS_KEY}.${postId}`, userId);
    window.localStorage.setItem(scopedKey, JSON.stringify(comments));
  } catch {
    // Ignore storage errors.
  }
};
