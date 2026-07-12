import { z } from "zod";

/* INBOUND (client → server): comes from OUTSIDE → we don't trust it → validate with Zod. */
export const JoinMsg = z.object({
  type: z.literal("join"),
  roomId: z.string().min(1),
  name: z.string().min(1).max(40),
});

export const ChatMsg = z.object({
  type: z.literal("chat"),
  text: z.string().min(1).max(2000),
});

export const CardCreateMsg = z.object({
  type: z.literal("card.create"),
  text: z.string().min(1).max(2000),
});

// every message a client may send, told apart by its `type`
export const ClientMsg = z.discriminatedUnion("type", [JoinMsg, ChatMsg, CardCreateMsg]);
export type ClientMsg = z.infer<typeof ClientMsg>;   // the TS type, derived from the schema

/* A card on the shared board. It travels over the wire, so its type lives here — shared by both sides. */
export type Card = { id: string; text: string; createdBy: string; seq: number };

/* OUTBOUND (server → client): WE make these, so we only need TYPES (no runtime check). */
export type PresenceMsg = { type: "presence"; roomId: string; members: string[] };
export type ChatBroadcast = { type: "chat"; roomId: string; from: string; text: string };
export type ErrorMsg = { type: "error"; message: string };
export type BoardSnapshotMsg = { type: "board.snapshot"; roomId: string; cards: Card[] };
export type CardCreatedMsg = { type: "card.created"; roomId: string; card: Card };
export type ServerMsg =
  | PresenceMsg
  | ChatBroadcast
  | ErrorMsg
  | BoardSnapshotMsg
  | CardCreatedMsg;
