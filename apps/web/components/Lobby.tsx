import { useState } from "react";

type LobbyProps = {
  userName: string;
  error: string;
  onCreate: (name: string) => void;
  onJoin: (roomId: string) => void;
};

export function Lobby({ userName, error, onCreate, onJoin }: LobbyProps) {
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight">SYMPOSIUM</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {userName
              ? `Welcome, ${userName}. Create a room or join one by code.`
              : "Set your name in the sidebar, then create or join a room."}
          </p>
        </div>

        {/* Create */}
        <div className="border border-neutral-300 dark:border-neutral-800">
          <h2 className="border-b border-neutral-300 px-4 py-2 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            Create a room
          </h2>
          <div className="flex gap-2 p-4">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate(roomName)}
              placeholder="e.g. CRDT research"
              className="flex-1 border border-neutral-400 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-neutral-700"
            />
            <button
              onClick={() => onCreate(roomName)}
              className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
            >
              Create
            </button>
          </div>
        </div>

        {/* Join */}
        <div className="border border-neutral-300 dark:border-neutral-800">
          <h2 className="border-b border-neutral-300 px-4 py-2 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            Join a room
          </h2>
          <div className="flex gap-2 p-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onJoin(code)}
              placeholder="room code, e.g. k3f9q2"
              className="flex-1 border border-neutral-400 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground dark:border-neutral-700"
            />
            <button
              onClick={() => onJoin(code)}
              className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
            >
              Join
            </button>
          </div>
        </div>

        {error && <p className="bg-foreground px-3 py-2 text-sm text-background">{error}</p>}
      </div>
    </main>
  );
}
