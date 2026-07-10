"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMsg, ServerMsg } from "@symposium/protocol";

const WS_URL = "ws://localhost:4000";

type ChatLine = { from: string; text: string };

export default function Home() {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("library");
  const [members, setMembers] = useState<string[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // auto-scroll chat to the newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // the `msg` here is typed as ClientMsg — the SAME schema the server validates against
  function sendMsg(msg: ClientMsg) {
    wsRef.current?.send(JSON.stringify(msg));
  }

  function join() {
    if (!name.trim() || !roomId.trim()) {
      setError("Enter a name and a room to join.");
      return;
    }
    setError("");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      sendMsg({ type: "join", roomId: roomId.trim(), name: name.trim() });
      setJoined(true);
    };

    ws.onerror = () => {
      setError("Couldn't reach the server — is the backend running on :4000?");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMsg; // shape guaranteed by the shared type
      if (msg.type === "presence") {
        setMembers(msg.members);
      } else if (msg.type === "chat") {
        setChat((prev) => [...prev, { from: msg.from, text: msg.text }]);
      }
    };

    ws.onclose = () => {
      setJoined(false);
      setMembers([]);
    };
  }

  function leave() {
    wsRef.current?.close();
    setChat([]);
  }

  function sendChat() {
    const text = draft.trim();
    if (!text) return;
    sendMsg({ type: "chat", text });
    setDraft("");
  }

  // ---------------- JOIN SCREEN ----------------
  if (!joined) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm border border-neutral-300 dark:border-neutral-800">
          <div className="border-b border-neutral-300 px-5 py-4 dark:border-neutral-800">
            <h1 className="font-mono text-lg font-semibold tracking-tight">SYMPOSIUM</h1>
            <p className="mt-1 text-xs text-neutral-500">research with friends — join a room</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="anurag"
                className="border border-neutral-400 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-neutral-700"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Room</span>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="library"
                className="border border-neutral-400 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-neutral-700"
              />
            </label>
            <button
              onClick={join}
              className="border border-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              Join room →
            </button>
            {error && (
              <p className="bg-foreground px-3 py-2 text-sm text-background">{error}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------------- ROOM SCREEN ----------------
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-800">
        <div>
          <span className="font-mono text-sm font-semibold">SYMPOSIUM</span>
          <span className="text-sm text-neutral-500"> / {roomId}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-500">{members.length} online</span>
          <button
            onClick={leave}
            className="border border-neutral-400 px-3 py-1 text-xs transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* presence sidebar */}
        <aside className="w-56 shrink-0 border-r border-neutral-300 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Who&apos;s here</h2>
          <ul className="flex flex-col gap-1.5">
            {members.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 bg-foreground" />
                {m}
                {m === name && <span className="text-neutral-500">(you)</span>}
              </li>
            ))}
          </ul>
        </aside>

        {/* chat */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {chat.length === 0 ? (
              <p className="text-sm text-neutral-500">No messages yet. Say hi 👋</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {chat.map((line, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-neutral-500">{line.from}</span>
                    <div className="mt-0.5 border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-800">
                      {line.text}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="flex gap-2 border-t border-neutral-300 p-3 dark:border-neutral-800"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 border border-neutral-400 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-neutral-700"
            />
            <button
              type="submit"
              className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
