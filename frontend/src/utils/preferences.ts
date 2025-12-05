import { type SavedPreferences } from "@/types/monitors";

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const coerceNumberRecord = (value: unknown): Record<string, number> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entries = Object.entries(value).reduce<Record<string, number>>((acc, [key, val]) => {
    const num = typeof val === "string" ? Number(val) : val;
    if (typeof num === "number" && Number.isFinite(num)) {
      acc[key] = num;
    }
    return acc;
  }, {});

  return Object.keys(entries).length > 0 ? entries : undefined;
};

export const normalizePreferences = (raw: unknown): SavedPreferences | null => {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const keywords = isStringArray(record.keywords) ? record.keywords : [];
  const platforms = isStringArray(record.platforms) ? record.platforms : [];
  const languages = isStringArray(record.languages) ? record.languages : [];
  const rawAlertsEnabled =
    record.threatIndexAlertsEnabled ??
    record.THREAT_INDEX_ALERTS_ENABLED ??
    record.threat_index_alerts_enabled;
  const threatIndexAlertsEnabled =
    typeof rawAlertsEnabled === "boolean"
      ? rawAlertsEnabled
      : typeof rawAlertsEnabled === "string"
        ? rawAlertsEnabled.toLowerCase() === "true" || rawAlertsEnabled === "1"
        : undefined;
  const threatIndexThresholds =
    coerceNumberRecord(record.threatIndexThresholds) ??
    coerceNumberRecord(record.THREAT_INDEX_THRESHOLDS) ??
    coerceNumberRecord(record.threat_index_thresholds);

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
