import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { ClientMsg, type ServerMsg } from "@symposium/protocol";

const app = express();
const PORT = 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

const server = app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// ---- in-memory room state ----
type Client = { socket: WebSocket; name: string };
const rooms = new Map<string, Set<Client>>();

// outbound is now TYPE-CHECKED: `msg` must be a valid ServerMsg
function send(socket: WebSocket, msg: ServerMsg) {
  socket.send(JSON.stringify(msg));
}

function broadcast(roomId: string, msg: ServerMsg) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  for (const c of clients) send(c.socket, msg);
}

function broadcastPresence(roomId: string) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const members = [...clients].map((c) => c.name);
  broadcast(roomId, { type: "presence", roomId, members });
}

wss.on("connection", (socket) => {
  let me: Client | null = null;
  let myRoom: string | null = null;

  socket.on("message", (data) => {
    // 1. is it valid JSON at all?
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      return send(socket, { type: "error", message: "messages must be JSON" });
    }

    // 2. does it match a known message shape? (Zod validates at runtime)
    const result = ClientMsg.safeParse(raw);
    if (!result.success) {
      return send(socket, { type: "error", message: "invalid message shape" });
    }
    const msg = result.data;   // ✅ fully typed from here — no more `any`

    // 3. handle it — the typeof hand-checks are GONE; Zod guarantees the shape
    if (msg.type === "join") {
      me = { socket, name: msg.name };
      myRoom = msg.roomId;
      if (!rooms.has(myRoom)) rooms.set(myRoom, new Set());
      rooms.get(myRoom)!.add(me);
      console.log(`➡️  ${me.name} joined "${myRoom}"`);
      broadcastPresence(myRoom);
    } else if (msg.type === "chat") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      console.log(`💬 ${me.name} in "${myRoom}": ${msg.text}`);
      broadcast(myRoom, { type: "chat", roomId: myRoom, from: me.name, text: msg.text });
    }
  });

  socket.on("close", () => {
    if (me && myRoom) {
      rooms.get(myRoom)?.delete(me);
      console.log(`⬅️  ${me.name} left "${myRoom}"`);
      broadcastPresence(myRoom);
    }
  });
});
