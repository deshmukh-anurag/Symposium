import type { RoomRef } from "@/lib/history";

type SidebarProps = {
  open: boolean;
  onToggle: () => void;
  recents: RoomRef[];
  currentRoomId: string | null;
  userName: string;
  onUserNameChange: (value: string) => void;
  onOpenRoom: (roomId: string) => void;
  onNewRoom: () => void;
};

export function Sidebar({
  open,
  onToggle,
  recents,
  currentRoomId,
  userName,
  onUserNameChange,
  onOpenRoom,
  onNewRoom,
}: SidebarProps) {
  // collapsed: a thin rail with just expand + new-room
  if (!open) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-neutral-300 py-3 dark:border-neutral-800">
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="border border-neutral-400 px-2 py-1 text-sm transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
        >
          ☰
        </button>
        <button
          onClick={onNewRoom}
          title="New room"
          className="border border-neutral-400 px-2 py-1 text-sm transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
        >
          +
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-300 dark:border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-300 px-4 py-3 dark:border-neutral-800">
        <span className="font-mono text-sm font-semibold tracking-tight">SYMPOSIUM</span>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          className="border border-neutral-400 px-2 text-sm transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
        >
          ◀
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewRoom}
          className="w-full border border-foreground px-3 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
        >
          + New room
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Recents</h2>
        {recents.length === 0 ? (
          <p className="text-xs text-neutral-500">No rooms yet. Create one ↑</p>
        ) : (
          <ul className="flex flex-col">
            {recents.map((r) => (
              <li key={r.roomId}>
                <button
                  onClick={() => onOpenRoom(r.roomId)}
                  className={`flex w-full flex-col items-start border-l-2 px-2 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
                    r.roomId === currentRoomId ? "border-foreground" : "border-transparent"
                  }`}
                >
                  <span className="w-full truncate text-sm">{r.name}</span>
                  <span className="font-mono text-[10px] text-neutral-500">#{r.roomId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-300 p-3 dark:border-neutral-800">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Your name</span>
          <input
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            placeholder="anurag"
            className="border border-neutral-400 bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground dark:border-neutral-700"
          />
        </label>
      </div>
    </aside>
  );
}
