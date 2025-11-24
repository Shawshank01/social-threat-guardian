export type SavedPreferences = {
  keywords: string[];
  platforms: string[];
  languages: string[];
  updatedAt?: string;
};

export type MonitoredPost = {
  id: string;
  platform: string;
  sourceTable: string;
  keyword: string | null;
  postText: string;
  predIntent: string | null;
  timeAgo: string | null;
  collectedAt: string | null;
  hateScore?: number | null;
  postUrl?: string | null;
};

export type PostComment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};
