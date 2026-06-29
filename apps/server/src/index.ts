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

// ---- in-memory room state (the server now REMEMBERS who's where) ----
type Client = { socket: WebSocket; name: string };
const rooms = new Map<string, Set<Client>>();      // roomId -> clients in it

// send a JS object to one socket as JSON text
function send(socket: WebSocket, msg: object) {
  socket.send(JSON.stringify(msg));
}

// fan-out: tell EVERYONE in a room the current member list
function broadcastPresence(roomId: string) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const members = [...clients].map((c) => c.name);
  for (const c of clients) {
    send(c.socket, { type: "presence", roomId, members });
  }
}

wss.on("connection", (socket) => {
  // runs once per connection → these vars are private to THIS client
  let me: Client | null = null;
  let myRoom: string | null = null;

  socket.on("message", (data) => {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());            // we now expect JSON, not raw text
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
      broadcastPresence(myRoom);                     // everyone sees the new arrival
    }
  });

  socket.on("close", () => {
    if (me && myRoom) {
      rooms.get(myRoom)?.delete(me);
      console.log(`⬅️  ${me.name} left "${myRoom}"`);
      broadcastPresence(myRoom);                     // everyone sees them leave
    }
  });
});
