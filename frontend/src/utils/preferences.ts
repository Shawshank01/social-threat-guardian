import { type SavedPreferences } from "@/types/monitors";

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).every(
    ([key, val]) => typeof key === "string" && typeof val === "number" && Number.isFinite(val),
  );
};

export const normalizePreferences = (raw: unknown): SavedPreferences | null => {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const keywords = isStringArray(record.keywords) ? record.keywords : [];
  const platforms = isStringArray(record.platforms) ? record.platforms : [];
  const languages = isStringArray(record.languages) ? record.languages : [];
  const threatIndexAlertsEnabled =
    typeof record.threatIndexAlertsEnabled === "boolean" ? record.threatIndexAlertsEnabled : undefined;
  const threatIndexThresholds = isNumberRecord(record.threatIndexThresholds)
    ? (record.threatIndexThresholds as Record<string, number>)
    : undefined;

  const preferences: SavedPreferences = {
    keywords,
    platforms,
    languages,
  };

  if (typeof record.updatedAt === "string") {
    preferences.updatedAt = record.updatedAt;
  }
  if (typeof threatIndexAlertsEnabled === "boolean") {
    preferences.threatIndexAlertsEnabled = threatIndexAlertsEnabled;
  }
  if (threatIndexThresholds) {
    preferences.threatIndexThresholds = threatIndexThresholds;
  }

  return preferences;
};
