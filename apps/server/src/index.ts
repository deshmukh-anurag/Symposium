import express from "express";
import { WebSocketServer, WebSocket } from "ws";

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

function send(socket: WebSocket, msg: object) {
  socket.send(JSON.stringify(msg));
}

// fan-out: send ANY message to everyone in a room  (the reusable primitive)
function broadcast(roomId: string, msg: object) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  for (const c of clients) send(c.socket, msg);
}

// presence now RIDES on broadcast
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
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return send(socket, { type: "error", message: "messages must be JSON" });
    }

    if (msg.type === "join") {
      if (typeof msg.roomId !== "string" || typeof msg.name !== "string") {
        return send(socket, { type: "error", message: "join needs roomId and name" });
      }
      me = { socket, name: msg.name };
      myRoom = msg.roomId;
      if (!rooms.has(myRoom)) rooms.set(myRoom, new Set());
      rooms.get(myRoom)!.add(me);
      console.log(`➡️  ${me.name} joined "${myRoom}"`);
      broadcastPresence(myRoom);
    }

    else if (msg.type === "chat") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      if (typeof msg.text !== "string") {
        return send(socket, { type: "error", message: "chat needs text" });
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
