import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { ClientMsg, type ServerMsg, type Card } from "@symposium/protocol";

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
// A room now holds people, the board's cards, AND a `seq` — its logical clock, which
// ticks once per op. This ordering is what makes concurrent edits converge later (M2 §5.4).
type Room = { clients: Set<Client>; cards: Card[]; seq: number };
const rooms = new Map<string, Room>();

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { clients: new Set(), cards: [], seq: 0 };
    rooms.set(roomId, room);
  }
  return room;
}

// outbound is TYPE-CHECKED: `msg` must be a valid ServerMsg
function send(socket: WebSocket, msg: ServerMsg) {
  socket.send(JSON.stringify(msg));
}

function broadcast(roomId: string, msg: ServerMsg) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const c of room.clients) send(c.socket, msg);
}

function broadcastPresence(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const members = [...room.clients].map((c) => c.name);
  broadcast(roomId, { type: "presence", roomId, members });
}

wss.on("connection", (socket) => {
  let me: Client | null = null;
  let myRoom: string | null = null;

  socket.on("message", (data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      return send(socket, { type: "error", message: "messages must be JSON" });
    }

    const result = ClientMsg.safeParse(raw);
    if (!result.success) {
      return send(socket, { type: "error", message: "invalid message shape" });
    }
    const msg = result.data;

    if (msg.type === "join") {
      me = { socket, name: msg.name };
      myRoom = msg.roomId;
      const room = getRoom(myRoom);
      room.clients.add(me);
      console.log(`➡️  ${me.name} joined "${myRoom}"`);
      // hand the joiner the current board so late arrivals see cards that already exist
      send(socket, { type: "board.snapshot", roomId: myRoom, cards: room.cards });
      broadcastPresence(myRoom);
    } else if (msg.type === "chat") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      console.log(`💬 ${me.name} in "${myRoom}": ${msg.text}`);
      broadcast(myRoom, { type: "chat", roomId: myRoom, from: me.name, text: msg.text });
    } else if (msg.type === "card.create") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      const room = getRoom(myRoom);
      const card: Card = {
        id: randomUUID(),
        text: msg.text,
        createdBy: me.name,
        seq: ++room.seq, // the room's logical clock ticks once, giving this op a global order
      };
      room.cards.push(card);
      console.log(`🗂️  ${me.name} created a card in "${myRoom}" (seq ${card.seq})`);
      broadcast(myRoom, { type: "card.created", roomId: myRoom, card });
    }
  });

  socket.on("close", () => {
    if (me && myRoom) {
      rooms.get(myRoom)?.clients.delete(me);
      console.log(`⬅️  ${me.name} left "${myRoom}"`);
      broadcastPresence(myRoom);
    }
  });
});
