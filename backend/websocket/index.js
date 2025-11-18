// /websocket/index.js
import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { onHateScoreUpdate } from "../services/hateScoreMonitor.js";

const DEFAULT_PATH = "/ws";

let wss = null;
const clients = new Set();
const socketIdentity = new WeakMap();
const userSockets = new Map();
let unsubscribeHateScore = null;

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(payload);
  } catch (err) {
    console.error("[websocket] failed to send payload:", err);
  }
}

function serializeMessage(data) {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch (err) {
    console.error("[websocket] failed to stringify message:", err);
    return null;
  }
}

export function broadcastMessage(message) {
  const payload = serializeMessage(message);
  if (!payload) return;

  for (const socket of clients) {
    safeSend(socket, payload);
  }
}

export function broadcastHateScoreUpdate(snapshot) {
  if (!snapshot) return;
  broadcastMessage({
    type: "HATE_SCORE_UPDATE",
    data: {
      value: snapshot.value ?? null,
      updatedAt: snapshot.updatedAt ?? null,
      sampleSize: snapshot.sampleSize ?? 0,
      tableName: snapshot.tableName ?? null,
    },
  });
}

function attachHateScoreListener() {
  if (unsubscribeHateScore) return;
  unsubscribeHateScore = onHateScoreUpdate((snapshot) => {
    broadcastHateScoreUpdate(snapshot);
  });
}

function extractTokenFromRequest(request) {
  if (!request) return null;

  const authHeader = request.headers?.authorization || "";
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  try {
    const host = request.headers?.host || "localhost";
    const absoluteUrl = new URL(request.url || "", `http://${host}`);
    return absoluteUrl.searchParams.get("token") || absoluteUrl.searchParams.get("authToken");
  } catch {
    return null;
  }
}

function authenticateRequest(request) {
  const token = extractTokenFromRequest(request);
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.sub || decoded?.id;
    if (!userId) {
      return null;
    }
    return {
      id: String(userId),
      email: decoded?.email || null,
      name: decoded?.name || null,
    };
  } catch (err) {
    console.warn("[websocket] failed to verify token:", err.message);
    return null;
  }
}

function indexSocketByUser(socket, identity) {
  if (!identity?.id) return;
  socketIdentity.set(socket, identity);

  if (!userSockets.has(identity.id)) {
    userSockets.set(identity.id, new Set());
  }
  userSockets.get(identity.id).add(socket);
}

function removeSocketFromIndex(socket) {
  const identity = socketIdentity.get(socket);
  if (!identity?.id) {
    return;
  }

  const bucket = userSockets.get(identity.id);
  if (bucket) {
    bucket.delete(socket);
    if (bucket.size === 0) {
      userSockets.delete(identity.id);
    }
  }

  socketIdentity.delete(socket);
}

export function sendMessageToUser(userId, message) {
  if (!userId) return;
  const bucket = userSockets.get(String(userId));
  if (!bucket || bucket.size === 0) return;

  const payload = serializeMessage(message);
  if (!payload) return;

  for (const socket of bucket) {
    safeSend(socket, payload);
  }
}

export function sendMessageToUsers(userIds = [], message) {
  const uniqueIds = Array.from(new Set(userIds.map((id) => String(id))));
  for (const id of uniqueIds) {
    sendMessageToUser(id, message);
  }
}

export function initWebSocketServer(httpServer, options = {}) {
  if (wss) {
    return wss;
  }

  const { path = DEFAULT_PATH } = options;
  wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (socket, request) => {
    clients.add(socket);
    const identity = authenticateRequest(request);
    if (identity) {
      indexSocketByUser(socket, identity);
    }

    safeSend(
      socket,
      serializeMessage({
        type: "CONNECTED",
        data: {
          connectedAt: new Date().toISOString(),
          authenticated: Boolean(identity),
          userId: identity?.id || null,
        },
      })
    );

    socket.on("message", (msg) => {
      if (!msg) return;
      let parsed;
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }
      if (parsed?.type === "PING") {
        safeSend(
          socket,
          serializeMessage({
            type: "PONG",
            data: { ts: Date.now() },
          })
        );
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      removeSocketFromIndex(socket);
    });

    socket.on("error", (err) => {
      console.error("[websocket] client error:", err);
      clients.delete(socket);
      removeSocketFromIndex(socket);
    });
  });

  wss.on("error", (err) => {
    console.error("[websocket] server error:", err);
  });

  attachHateScoreListener();

  return wss;
}

export function stopWebSocketServer() {
  if (unsubscribeHateScore) {
    unsubscribeHateScore();
    unsubscribeHateScore = null;
  }

  for (const socket of clients) {
    try {
      socket.close();
    } catch {
      // ignore
    }
  }
  clients.clear();

  if (wss) {
    wss.close();
    wss = null;
  }
}

export function getWebSocketStats() {
  return {
    clientCount: clients.size,
    path: wss?.options?.path || DEFAULT_PATH,
    authenticatedUsers: userSockets.size,
  };
}
