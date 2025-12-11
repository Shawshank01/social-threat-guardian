const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const getAuthHeaders = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string | null;
  message: string | null;
  payload: any;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export async function fetchNotifications(
  token: string,
  options: NotificationListOptions = {},
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (options.limit) params.append("limit", String(options.limit));
  if (options.offset) params.append("offset", String(options.offset));
  if (options.unreadOnly) params.append("unreadOnly", "true");

  const url = buildApiUrl(`notifications${params.toString() ? `?${params.toString()}` : ""}`);
  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(token),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: Notification[];
    error?: string;
  };

  if (response.status === 401) {
    const error = new Error(data.error ?? "Invalid or expired token");
    (error as any).isUnauthorized = true;
    throw error;
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to fetch notifications.");
  }

  return data.data ?? [];
}

export async function fetchUnreadCount(token: string): Promise<number> {
  const response = await fetch(buildApiUrl("notifications/unread-count"), {
    method: "GET",
    headers: getAuthHeaders(token),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { count: number };
    error?: string;
  };

  if (response.status === 401) {
    const error = new Error(data.error ?? "Invalid or expired token");
    (error as any).isUnauthorized = true;
    throw error;
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to fetch unread count.");
  }

  return data.data?.count ?? 0;
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
): Promise<boolean> {
  const response = await fetch(buildApiUrl(`notifications/${notificationId}/read`), {
    method: "POST",
    headers: getAuthHeaders(token),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { updated: boolean };
    error?: string;
  };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to mark notification as read.");
  }

  return data.data?.updated ?? false;
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const response = await fetch(buildApiUrl("notifications/read-all"), {
    method: "POST",
    headers: getAuthHeaders(token),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { updatedCount: number };
    error?: string;
  };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Unable to mark all notifications as read.");
  }

  return data.data?.updatedCount ?? 0;
}
