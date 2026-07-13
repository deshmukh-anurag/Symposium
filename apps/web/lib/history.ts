// Per-browser room history + remembered name, stored in localStorage.
// This is the "now, no DB" version — see ARCHITECTURE.md §6.5. When persistence lands,
// these reads move to the server (room membership + event log) with no change to callers.

import type { Card } from "@symposium/protocol";

export type RoomRef = { roomId: string; name: string };

// a frozen "last-seen" view of a room, shown read-only after you leave (stand-in for
// event-log replay to your last-seen point).
export type RoomSnapshot = {
  name: string;
  cards: Card[];
  chat: { from: string; text: string }[];
  members: string[];
};

const RECENTS_KEY = "symposium.recents";
const NAME_KEY = "symposium.userName";

export function loadRecents(): RoomRef[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RoomRef[]) : [];
  } catch {
    return [];
  }
}

// most-recent-first, de-duplicated by roomId, capped
export function saveRecent(room: RoomRef): RoomRef[] {
  const rest = loadRecents().filter((r) => r.roomId !== room.roomId);
  const next = [room, ...rest].slice(0, 20);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function loadUserName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveUserName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

const snapKey = (roomId: string) => `symposium.snap.${roomId}`;

// keep the latest live state so re-opening a left room shows your last-seen view
export function saveSnapshot(roomId: string, snap: RoomSnapshot): void {
  localStorage.setItem(snapKey(roomId), JSON.stringify(snap));
}

export function loadSnapshot(roomId: string): RoomSnapshot | null {
  try {
    const raw = localStorage.getItem(snapKey(roomId));
    return raw ? (JSON.parse(raw) as RoomSnapshot) : null;
  } catch {
    return null;
  }
}
