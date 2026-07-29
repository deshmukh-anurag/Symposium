import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { verifyToken } from "../lib/jwt";
import type { Server } from "node:http";
import { ClientMsg, type ServerMsg, type Card } from "@symposium/protocol";
import { prisma } from "@symposium/db";
import { runAgent } from "../agent";
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

function toWireCard(row: {
  id: string;
  text: string;
  authorName: string;
  seq: number;
  authorKind: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
}): Card {
  return {
    id: row.id,
    text: row.text,
    createdBy: row.authorName,
    seq: row.seq,
    authorKind: row.authorKind as Card["authorKind"],
    sourceUrl: row.sourceUrl ?? undefined,
    sourceTitle: row.sourceTitle ?? undefined,
  };
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

// Persist ONE card, cache it, and broadcast it — the single write-through path.
// Humans (card.create) and the agent (ask) both go through here, so a human card
// and an AI card are created identically; only the author fields differ.
async function createCard(
  roomId: string,
  input: {
    text: string;
    authorId: string | null;
    authorName: string;
    authorKind: "USER" | "GUEST" | "AGENT";
    sourceUrl?: string;
    sourceTitle?: string;
  },
): Promise<Card | null> {
  const room = rooms.get(roomId);
  if (!room) return null; // room fell out of the cache / never existed
  const row = await prisma.card.create({
    data: {
      roomId,
      text: input.text,
      seq: ++room.seq, // per-room logical clock
      authorId: input.authorId, // null for guests AND the agent — schema allows it
      authorName: input.authorName,
      authorKind: input.authorKind,
      sourceUrl: input.sourceUrl ?? null,
      sourceTitle: input.sourceTitle ?? null,
    },
  });
  const card = toWireCard(row);
  room.cards.push(card);
  broadcast(roomId, { type: "card.created", roomId, card });
  return card;
}

// Last-Writer-Wins edit: overwrite the text, let @updatedAt bump the timestamp,
// update the cached copy, and broadcast. Any member may edit any card. In our
// single-server model the server's ARRIVAL ORDER is "last writer" — so we just
// apply edits as they land and every client converges by replaying the same
// card.updated broadcasts in the same order. Returns null if the card isn't here.
async function editCard(roomId: string, cardId: string, text: string): Promise<Card | null> {
  const room = rooms.get(roomId);
  if (!room) return null;
  const idx = room.cards.findIndex((c) => c.id === cardId); // also proves the card belongs to THIS room
  if (idx === -1) return null;
  const row = await prisma.card.update({
    where: { id: cardId },
    data: { text }, // @updatedAt updates the timestamp automatically
  });
  const card = toWireCard(row);
  room.cards[idx] = card; // replace the cached copy in place (keep board order)
  broadcast(roomId, { type: "card.updated", roomId, card });
  return card;
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
        await createCard(myRoom, {
          text: msg.text,
          authorId: me.userId, // null for guests — the schema allows it
          authorName: me.name,
          authorKind: me.userId ? "USER" : "GUEST",
        });

      } else if (msg.type === "ask") {
        if (!myRoom) return send(socket, { type: "error", message: "join a room first" });
        const roomId = myRoom; // capture now — myRoom could change if they later rejoin elsewhere

        // let the room know the agent started (ephemeral status line, not persisted)
        broadcast(roomId, { type: "chat", roomId, from: "AI", text: `🔬 Researching: ${msg.text}` });

        // Fire-and-forget: do NOT await. The agent loop can take many seconds, and this
        // socket must stay responsive (chat, cards, presence) while it runs in the background.
        // The .catch is MANDATORY — an unhandled promise rejection would crash the whole server.
        runAgent({
          question: msg.text,
          onCard: async ({ text, sourceUrl, sourceTitle }) => {
            await createCard(roomId, {
              text,
              authorId: null, // the agent has no user account
              authorName: "AI",
              authorKind: "AGENT",
              sourceUrl,
              sourceTitle,
            });
          },
          onNotice: (text) => broadcast(roomId, { type: "chat", roomId, from: "AI", text }),
        }).catch((err) => {
          console.error("agent run failed:", err);
          broadcast(roomId, { type: "chat", roomId, from: "AI", text: "⚠️ Research failed — see server logs." });
        });

      } else if (msg.type === "card.edit") {
        if (!myRoom) return send(socket, { type: "error", message: "join a room first" });
        const updated = await editCard(myRoom, msg.id, msg.text);
        if (!updated) return send(socket, { type: "error", message: "card not found" });
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