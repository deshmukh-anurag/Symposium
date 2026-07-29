"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMsg, ServerMsg, Card } from "@symposium/protocol";
import { Sidebar } from "@/components/Sidebar";
import { Lobby } from "@/components/Lobby";
import { RoomView } from "@/components/RoomView";
import { AuthScreen } from "@/components/AuthScreen";
import type { ChatLine } from "@/components/Chat";
import {
  loadRecents,
  saveRecent,
  saveSnapshot,
  loadSnapshot,
  type RoomRef,
} from "@/lib/history";
import {
  loadIdentity,
  saveIdentity,
  clearIdentity,
  identityName,
  wsUrlFor,
  type Identity,
} from "@/lib/auth";

export default function Home() {
  const [ready, setReady] = useState(false); // localStorage is unavailable during SSR
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recents, setRecents] = useState<RoomRef[]>([]);
  const [room, setRoom] = useState<{ roomId: string; name: string } | null>(null);
  const [connected, setConnected] = useState(false); // false while viewing a frozen (left) room
  const [members, setMembers] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [cardDraft, setCardDraft] = useState("");
  const [askDraft, setAskDraft] = useState("");
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // load per-browser state after mount, then reveal the UI (avoids flashing the auth screen)
  useEffect(() => {
    setIdentity(loadIdentity());
    setRecents(loadRecents());
    setReady(true);
  }, []);

  // while connected, keep the room's last-seen snapshot fresh so leaving freezes an accurate view
  useEffect(() => {
    if (connected && room) {
      saveSnapshot(room.roomId, { name: room.name, cards, chat, members });
    }
  }, [connected, room, cards, chat, members]);

  function remember(ref: RoomRef) {
    setRecents(saveRecent(ref));
  }

  function authenticate(next: Identity) {
    saveIdentity(next);
    setIdentity(next);
    setAuthNotice("");
  }

  function clearRoomState() {
    setRoom(null);
    setConnected(false);
    setMembers([]);
    setCards([]);
    setChat([]);
    setError("");
  }

  function logout() {
    wsRef.current?.close();
    wsRef.current = null;
    clearIdentity();
    setIdentity(null);
    setAuthNotice("");
    clearRoomState();
  }

  function handleServerMsg(msg: ServerMsg) {
    if (msg.type === "room.created") {
      remember({ roomId: msg.roomId, name: msg.name });
      // the socket already carries our identity — joining only needs the room
      wsRef.current?.send(JSON.stringify({ type: "join", roomId: msg.roomId } satisfies ClientMsg));
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
    } else if (msg.type === "card.updated") {
      // LWW: replace our copy with the server's new version of that card
      setCards((prev) => prev.map((c) => (c.id === msg.card.id ? msg.card : c)));
    } else if (msg.type === "error") {
      setError(msg.message);
    }
  }

  // open a fresh socket (closing any current one — a socket is bound to one room) + send the first message
  function openSocket(id: Identity, firstMessage: ClientMsg) {
    wsRef.current?.close();
    setError("");
    const ws = new WebSocket(wsUrlFor(id)); // identity rides in the connect URL
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify(firstMessage));
    ws.onmessage = (e) => handleServerMsg(JSON.parse(e.data) as ServerMsg);
    ws.onerror = () => setError("Couldn't reach the server — is the backend running on :4000?");
    ws.onclose = (e) => {
      // 4001 = the server refused our identity (bad or expired token) → force a fresh login
      if (e.code === 4001) {
        clearIdentity();
        setIdentity(null);
        clearRoomState();
        setAuthNotice("Your session expired — please log in again.");
      }
    };
  }

  function createRoom(name: string) {
    if (!identity) return;
    if (!name.trim()) return setError("Give the room a name.");
    openSocket(identity, { type: "room.create", name: name.trim() });
  }

  // go live in a room by code (from the lobby, or the Join button in a frozen view)
  function joinRoom(roomId: string) {
    if (!identity) return;
    if (!roomId.trim()) return setError("Enter a room code.");
    openSocket(identity, { type: "join", roomId: roomId.trim() });
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
    clearRoomState();
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

  // ask the AI to research — the agent runs on the server and streams cards back live
  function askAI() {
    const text = askDraft.trim();
    if (!text) return;
    wsRef.current?.send(JSON.stringify({ type: "ask", text } satisfies ClientMsg));
    setAskDraft("");
  }

  // edit a card — server applies Last-Writer-Wins and broadcasts card.updated to everyone
  function editCard(id: string, text: string) {
    wsRef.current?.send(JSON.stringify({ type: "card.edit", id, text } satisfies ClientMsg));
  }

  if (!ready) return null;
  if (!identity) return <AuthScreen notice={authNotice} onAuthenticated={authenticate} />;

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        recents={recents}
        currentRoomId={room?.roomId ?? null}
        identity={identity}
        onLogout={logout}
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
          userName={identityName(identity)}
          frozen={!connected}
          members={members}
          cards={cards}
          cardDraft={cardDraft}
          onCardDraftChange={setCardDraft}
          onAddCard={addCard}
          onEditCard={editCard}
          askDraft={askDraft}
          onAskDraftChange={setAskDraft}
          onAsk={askAI}
          chat={chat}
          chatDraft={chatDraft}
          onChatDraftChange={setChatDraft}
          onSendChat={sendChat}
          onLeave={leaveRoom}
          onJoin={() => joinRoom(room.roomId)}
        />
      ) : (
        <Lobby userName={identityName(identity)} error={error} onCreate={createRoom} onJoin={joinRoom} />
      )}
    </div>
  );
}
