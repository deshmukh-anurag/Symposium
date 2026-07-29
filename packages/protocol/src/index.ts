import { z } from "zod";

/* INBOUND (client → server): comes from OUTSIDE → we don't trust it → validate with Zod. */
export const JoinMsg = z.object({
  type: z.literal("join"),
  roomId: z.string().min(1),
});

export const ChatMsg = z.object({
  type: z.literal("chat"),
  text: z.string().min(1).max(2000),
});

export const CardCreateMsg = z.object({
  type: z.literal("card.create"),
  text: z.string().min(1).max(2000),
});

// edit an existing card's text. Last-Writer-Wins: the server applies edits in the
// order they arrive, so the last one to land is the winner and everyone converges.
export const CardEditMsg = z.object({
  type: z.literal("card.edit"),
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

// create a brand-new room — the human names it; the SERVER mints the unique roomId
export const RoomCreateMsg = z.object({
  type: z.literal("room.create"),
  name: z.string().min(1).max(60),
});

export const AskMsg = z.object({
  type: z.literal("ask"),
  text: z.string().min(1).max(2000),
});

// every message a client may send, told apart by its `type`
export const ClientMsg = z.discriminatedUnion("type", [
  JoinMsg,
  ChatMsg,
  CardCreateMsg,
  CardEditMsg,
  RoomCreateMsg,
  AskMsg,
]);
export type ClientMsg = z.infer<typeof ClientMsg>; // the TS type, derived from the schema

/* A card on the shared board. It travels over the wire, so its type lives here — shared by both sides.
   authorKind/source* are optional: human cards omit them, AI cards fill them in. */
export type Card = {
  id: string;
  text: string;
  createdBy: string;
  seq: number;
  authorKind?: "USER" | "GUEST" | "AGENT";
  sourceUrl?: string;
  sourceTitle?: string;
};

/* OUTBOUND (server → client): WE make these, so we only need TYPES (no runtime check). */
export type PresenceMsg = { type: "presence"; roomId: string; members: string[] };
export type ChatBroadcast = { type: "chat"; roomId: string; from: string; text: string };
export type ErrorMsg = { type: "error"; message: string; code?: string };
export type RoomCreatedMsg = { type: "room.created"; roomId: string; name: string };
// the snapshot now carries the room's display name → client can title it + save to history
export type BoardSnapshotMsg = { type: "board.snapshot"; roomId: string; name: string; cards: Card[] };
export type CardCreatedMsg = { type: "card.created"; roomId: string; card: Card };
// a card was edited — carries the whole new card so clients just replace their copy
export type CardUpdatedMsg = { type: "card.updated"; roomId: string; card: Card };
export type ServerMsg =
  | PresenceMsg
  | ChatBroadcast
  | ErrorMsg
  | RoomCreatedMsg
  | BoardSnapshotMsg
  | CardCreatedMsg
  | CardUpdatedMsg;
