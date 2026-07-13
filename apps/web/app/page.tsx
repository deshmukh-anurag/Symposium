"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMsg, ServerMsg, Card } from "@symposium/protocol";
import { Sidebar } from "@/components/Sidebar";
import { Lobby } from "@/components/Lobby";
import { RoomView } from "@/components/RoomView";
import type { ChatLine } from "@/components/Chat";
import {
  loadRecents,
  saveRecent,
  loadUserName,
  saveUserName,
  saveSnapshot,
  loadSnapshot,
  type RoomRef,
} from "@/lib/history";

const WS_URL = "ws://localhost:4000";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState("");
  const [recents, setRecents] = useState<RoomRef[]>([]);
  const [room, setRoom] = useState<{ roomId: string; name: string } | null>(null);
  const [connected, setConnected] = useState(false); // false while viewing a frozen (left) room
  const [members, setMembers] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [cardDraft, setCardDraft] = useState("");
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const joinAsRef = useRef(""); // the display name to join with (avoids stale closures)

  // localStorage isn't available during SSR → load per-browser state after mount
  useEffect(() => {
    setUserName(loadUserName());
    setRecents(loadRecents());
  }, []);

  // while connected, keep the room's last-seen snapshot fresh so leaving freezes an accurate view
  useEffect(() => {
    if (connected && room) {
      saveSnapshot(room.roomId, { name: room.name, cards, chat, members });
    }
  }, [connected, room, cards, chat, members]);

  function changeUserName(name: string) {
    setUserName(name);
    saveUserName(name);
  }

  function remember(ref: RoomRef) {
    setRecents(saveRecent(ref));
  }

  function handleServerMsg(msg: ServerMsg) {
    if (msg.type === "room.created") {
      remember({ roomId: msg.roomId, name: msg.name });
      wsRef.current?.send(
        JSON.stringify({ type: "join", roomId: msg.roomId, name: joinAsRef.current } satisfies ClientMsg),
      );
    } else if (msg.type === "board.snapshot") {
      setRoom({ roomId: msg.roomId, name: msg.name });
      setConnected(true); // we are now live
      setCards(msg.cards);
      setMembers([]);
      setChat([]);
      setError("");
      remember({ roomId: msg.roomId, name: msg.name });
    } else if (msg.type === "presence") {
      setMembers(msg.members);
    } else if (msg.type === "chat") {
      setChat((prev) => [...prev, { from: msg.from, text: msg.text }]);
    } else if (msg.type === "card.created") {
      setCards((prev) => [...prev, msg.card]);
    } else if (msg.type === "error") {
      setError(msg.message);
    }
  }

  // open a fresh socket (closing any current one — a socket is bound to one room) + send the first message
  function openSocket(firstMessage: ClientMsg) {
    wsRef.current?.close();
    setError("");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify(firstMessage));
    ws.onmessage = (e) => handleServerMsg(JSON.parse(e.data) as ServerMsg);
    ws.onerror = () => setError("Couldn't reach the server — is the backend running on :4000?");
  }

  function createRoom(name: string) {
    if (!userName.trim()) return setError("Set your name in the sidebar first.");
    if (!name.trim()) return setError("Give the room a name.");
    joinAsRef.current = userName.trim();
    openSocket({ type: "room.create", name: name.trim() });
  }

  // go live in a room by code (from the lobby, or the Join button in a frozen view)
  function joinRoom(roomId: string) {
    if (!userName.trim()) return setError("Set your name in the sidebar first.");
    if (!roomId.trim()) return setError("Enter a room code.");
    joinAsRef.current = userName.trim();
    openSocket({ type: "join", roomId: roomId.trim(), name: userName.trim() });
  }

  // open a room from history WITHOUT connecting → frozen, read-only, last-seen view
  function openRecent(roomId: string, nameHint: string) {
    wsRef.current?.close();
    wsRef.current = null;
    const snap = loadSnapshot(roomId);
    setRoom({ roomId, name: snap?.name ?? nameHint });
    setConnected(false);
    setCards(snap?.cards ?? []);
    setChat(snap?.chat ?? []);
    setMembers(snap?.members ?? []);
    setError("");
  }

  // Leave = close the connection but FREEZE in place (keep showing the last-seen room, read-only)
  function leaveRoom() {
    if (room) saveSnapshot(room.roomId, { name: room.name, cards, chat, members });
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }

  // "+ New room" → drop back to the lobby
  function goToLobby() {
    wsRef.current?.close();
    wsRef.current = null;
    setRoom(null);
    setConnected(false);
    setMembers([]);
    setCards([]);
    setChat([]);
    setError("");
  }

  function sendChat() {
    const text = chatDraft.trim();
    if (!text) return;
    wsRef.current?.send(JSON.stringify({ type: "chat", text } satisfies ClientMsg));
    setChatDraft("");
  }

  function addCard() {
    const text = cardDraft.trim();
    if (!text) return;
    wsRef.current?.send(JSON.stringify({ type: "card.create", text } satisfies ClientMsg));
    setCardDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        recents={recents}
        currentRoomId={room?.roomId ?? null}
        userName={userName}
        onUserNameChange={changeUserName}
        onOpenRoom={(roomId) => {
          const ref = recents.find((r) => r.roomId === roomId);
          openRecent(roomId, ref?.name ?? roomId);
        }}
        onNewRoom={goToLobby}
      />

      {room ? (
        <RoomView
          roomName={room.name}
          roomId={room.roomId}
          userName={userName}
          frozen={!connected}
          members={members}
          cards={cards}
          cardDraft={cardDraft}
          onCardDraftChange={setCardDraft}
          onAddCard={addCard}
          chat={chat}
          chatDraft={chatDraft}
          onChatDraftChange={setChatDraft}
          onSendChat={sendChat}
          onLeave={leaveRoom}
          onJoin={() => joinRoom(room.roomId)}
        />
      ) : (
        <Lobby userName={userName} error={error} onCreate={createRoom} onJoin={joinRoom} />
      )}
    </div>
  );
}
