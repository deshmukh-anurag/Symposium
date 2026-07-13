import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@symposium/db";
import { ClientMsg, type ServerMsg, type Card } from "@symposium/protocol";
import handleSignup from "./controllers/signup";
const app = express();
const PORT = 4000;

app.use(express.json()); 

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

app.post("/auth/signup", handleSignup);


const server = app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// ---- in-memory room state ----
type Client = { socket: WebSocket; name: string };
type Room = { name: string; clients: Set<Client>; cards: Card[]; seq: number };
const rooms = new Map<string, Room>();

function newRoomId(): string {
  let id: string;
  do {
    id = randomUUID().replace(/-/g, "").slice(0, 6);
  } while (rooms.has(id));
  return id;
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

    if (msg.type === "room.create") {
      // the human names it; WE mint the unique id. Creating does not join — the client joins next.
      const roomId = newRoomId();
      rooms.set(roomId, { name: msg.name, clients: new Set(), cards: [], seq: 0 });
      console.log(`🆕 room "${msg.name}" created → ${roomId}`);
      send(socket, { type: "room.created", roomId, name: msg.name });
    } else if (msg.type === "join") {
      const room = rooms.get(msg.roomId);
      if (!room) {
        // unknown code is an ERROR, not an implicit create (no ghost rooms)
        return send(socket, {
          type: "error",
          code: "room_not_found",
          message: `No room with id "${msg.roomId}".`,
        });
      }
      me = { socket, name: msg.name };
      myRoom = msg.roomId;
      room.clients.add(me);
      console.log(`➡️  ${me.name} joined "${room.name}" (${myRoom})`);
      // hand the joiner the room's name + current board (late arrivals see existing cards)
      send(socket, { type: "board.snapshot", roomId: myRoom, name: room.name, cards: room.cards });
      broadcastPresence(myRoom);
    } else if (msg.type === "chat") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      console.log(`💬 ${me.name} in ${myRoom}: ${msg.text}`);
      broadcast(myRoom, { type: "chat", roomId: myRoom, from: me.name, text: msg.text });
    } else if (msg.type === "card.create") {
      if (!me || !myRoom) {
        return send(socket, { type: "error", message: "join a room first" });
      }
      const room = getRoomOrNull(myRoom);
      if (!room) return;
      const card: Card = {
        id: randomUUID(),
        text: msg.text,
        createdBy: me.name,
        seq: ++room.seq, // the room's logical clock ticks once, giving this op a global order
      };
      room.cards.push(card);
      console.log(`🗂️  ${me.name} created a card in ${myRoom} (seq ${card.seq})`);
      broadcast(myRoom, { type: "card.created", roomId: myRoom, card });
    }
  });

  socket.on("close", () => {
    if (me && myRoom) {
      rooms.get(myRoom)?.clients.delete(me);
      console.log(`⬅️  ${me.name} left ${myRoom}`);
      broadcastPresence(myRoom);
    }
  });
});

function getRoomOrNull(roomId: string): Room | null {
  return rooms.get(roomId) ?? null;
}
