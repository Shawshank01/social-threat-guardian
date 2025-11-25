import { type SavedPreferences } from "@/types/monitors";

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

