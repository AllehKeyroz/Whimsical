#!/usr/bin/env node
/**
 * Minimal WebSocket relay for cross-device collaboration.
 *
 * Usage:
 *   npm run collab
 *   then put ws://localhost:8787 in the Share panel (Relay WebSocket).
 *
 * The relay is intentionally dumb: it groups sockets by `room` query param and
 * fans out every message to the other sockets in that room. It does not persist
 * boards and does not authenticate users. The room code is the only secret.
 */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const MAX_PAYLOAD = 4 * 1024 * 1024; // 4 MB per message

const rooms = new Map(); // room -> Set<WebSocket>

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: [...rooms.values()].reduce((n, s) => n + s.size, 0) }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Whimsical collaboration relay. Connect with a WebSocket client.\n");
});

const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const room = (url.searchParams.get("room") || "").slice(0, 64);
  const name = (url.searchParams.get("name") || "Convidado").slice(0, 40);
  const client = (url.searchParams.get("client") || "").slice(0, 40);
  if (!room) {
    ws.close(1008, "room required");
    return;
  }
  ws.room = room;
  ws.name = name;
  ws.client = client;
  ws.isAlive = true;

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  console.log(`[room ${room}] + ${name} (${client}) · ${rooms.get(room).size} online`);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    const peers = rooms.get(room);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === 1) {
        try {
          peer.send(data.toString());
        } catch {
          /* ignore */
        }
      }
    }
  });

  ws.on("close", () => {
    const peers = rooms.get(room);
    if (!peers) return;
    peers.delete(ws);
    if (!peers.size) rooms.delete(room);
    console.log(`[room ${room}] - ${name} · ${peers.size} online`);
  });
});

const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, 30000);
wss.on("close", () => clearInterval(interval));

server.listen(PORT, () => {
  console.log(`\n◈ Whimsical relay listening on ws://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Put ws://localhost:${PORT} in the Share panel.\n`);
});
