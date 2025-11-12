// /websocket/index.js
import WebSocket, { WebSocketServer } from "ws";
import { onHateScoreUpdate } from "../services/hateScoreMonitor.js";

const DEFAULT_PATH = "/ws";

let wss = null;
const clients = new Set();
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

export function initWebSocketServer(httpServer, options = {}) {
  if (wss) {
    return wss;
  }

  const { path = DEFAULT_PATH } = options;
  wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (socket) => {
    clients.add(socket);
    safeSend(
      socket,
      serializeMessage({
        type: "CONNECTED",
        data: { connectedAt: new Date().toISOString() },
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
    });

    socket.on("error", (err) => {
      console.error("[websocket] client error:", err);
      clients.delete(socket);
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
  };
}
