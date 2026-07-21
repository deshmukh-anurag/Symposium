import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { verifyToken } from "../lib/jwt";
import type { Server } from "node:http";
import { ClientMsg, type ServerMsg, type Card } from "@symposium/protocol";
import { prisma } from "@symposium/db";
// ---- in-memory room state ----
type Client = { socket: WebSocket; name: string; userId: string | null };

type Room = { name: string; clients: Set<Client>; cards: Card[]; seq: number };
const rooms = new Map<string, Room>();

async function newRoomId(): Promise<string> {
  for (;;) {
    const id = randomUUID().replace(/-/g, "").slice(0, 6);
    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) return id;
  }
}

function toWireCard(row: { id: string; text: string; authorName: string; seq: number }): Card {
  return { id: row.id, text: row.text, createdBy: row.authorName, seq: row.seq };
}

async function getOrHydrateRoom(roomId: string): Promise<Room | null> {
  const cached = rooms.get(roomId);
  if (cached) return cached;                    // hot path — no DB

  const row = await prisma.room.findUnique({
    where: { id: roomId },
    include: { cards: { orderBy: { seq: "asc" } } },   // one query, not two
  });
  if (!row) return null;                        // truly doesn't exist

  const cards = row.cards.map(toWireCard);
  const room: Room = {
    name: row.name,
    clients: new Set(),                         // nobody is connected to a just-loaded room
    cards,
    seq: cards.length ? cards[cards.length - 1].seq : 0,   // ← resume the clock
  };
  rooms.set(roomId, room);                      // cache it for next time
  return room;
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

  wss.on("connection", (socket, req) => {
    // ---- establish identity ONCE, from the connect URL (browsers can't set WS headers) ----
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    const guest = url.searchParams.get("guest");

    let identity: { userId: string | null; name: string };
    if (token) {
      try {
        const payload = verifyToken(token);          // throws if bad/expired
        identity = { userId: payload.sub, name: payload.name };
      } catch {
        socket.close(4001, "invalid or expired token"); // 4000–4999 = app-defined close codes
        return;
      }
    } else if (guest && guest.trim()) {
      identity = { userId: null, name: guest.trim() };  // no account, just a name
    } else {
      socket.close(4001, "identity required");
      return;
    }

    const me: Client = { socket, name: identity.name, userId: identity.userId };
    let myRoom: string | null = null;

    socket.on("message", async (data) => {
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
        if (!me.userId) {
          return send(socket, { type: "error", message: "log in to create a room" });
        }

        const roomId = await newRoomId();               // ← await
        await prisma.room.create({
          data: { id: roomId, name: msg.name, ownerId: me.userId },   // ← THE MISSING WRITE
        });
        rooms.set(roomId, { name: msg.name, clients: new Set(), cards: [], seq: 0 });
        send(socket, { type: "room.created", roomId, name: msg.name });

      } else if (msg.type === "join") {
        const room = await getOrHydrateRoom(msg.roomId);   // ← Map hit, else DB, else null
        if (!room) {
          return send(socket, { type: "error", code: "room_not_found", message: `No room with id "${msg.roomId}".` });
        }
        myRoom = msg.roomId;
        room.clients.add(me);
        send(socket, { type: "board.snapshot", roomId: myRoom, name: room.name, cards: room.cards });
        broadcastPresence(myRoom);
      }
 else if (msg.type === "chat") {
        if (!myRoom) return send(socket, { type: "error", message: "join a room first" });
        await prisma.message.create({
          data: {
            roomId: myRoom,
            text: msg.text,
            authorId: me.userId,
            authorName: me.name,
            authorKind: me.userId ? "USER" : "GUEST",
          },
        });
        broadcast(myRoom, { type: "chat", roomId: myRoom, from: me.name, text: msg.text });

      } else if (msg.type === "card.create") {
        if (!myRoom) return send(socket, { type: "error", message: "join a room first" });
        const room = rooms.get(myRoom);
        if (!room) return;
        const row = await prisma.card.create({
          data: {
            roomId: myRoom,
            text: msg.text,
            seq: ++room.seq,
            authorId: me.userId,                                // null for guests — the schema allows it
            authorName: me.name,                                // the snapshot
            authorKind: me.userId ? "USER" : "GUEST",
          },
        });
        const card = toWireCard(row);
        room.cards.push(card);
        broadcast(myRoom, { type: "card.created", roomId: myRoom, card });
      }
    });

    socket.on("close", () => {
      if (myRoom) {
        rooms.get(myRoom)?.clients.delete(me);
        broadcastPresence(myRoom);
      }
    });
  });
}