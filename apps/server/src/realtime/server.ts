import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { ClientMsg, type ServerMsg, type Card } from "@symposium/protocol";

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

// attach the WebSocket server onto the existing HTTP server (shared port)
export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server });

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
        const roomId = newRoomId();
        rooms.set(roomId, { name: msg.name, clients: new Set(), cards: [], seq: 0 });
        console.log(`🆕 room "${msg.name}" created → ${roomId}`);
        send(socket, { type: "room.created", roomId, name: msg.name });
      } else if (msg.type === "join") {
        const room = rooms.get(msg.roomId);
        if (!room) {
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
        const room = rooms.get(myRoom);
        if (!room) return;
        const card: Card = {
          id: randomUUID(),
          text: msg.text,
          createdBy: me.name,
          seq: ++room.seq,
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
}
