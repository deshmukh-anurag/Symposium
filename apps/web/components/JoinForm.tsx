type JoinFormProps = {
  name: string;
  roomId: string;
  error: string;
  onNameChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onJoin: () => void;
};

export function JoinForm({ name, roomId, error, onNameChange, onRoomChange, onJoin }: JoinFormProps) {
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
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
              placeholder="anurag"
              className="border border-neutral-400 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-neutral-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-500">Room</span>
            <input
              value={roomId}
              onChange={(e) => onRoomChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
              placeholder="library"
              className="border border-neutral-400 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-neutral-700"
            />
          </label>
          <button
            onClick={onJoin}
            className="border border-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
          >
            Join room →
          </button>
          {error && <p className="bg-foreground px-3 py-2 text-sm text-background">{error}</p>}
        </div>
      </div>
    </main>
  );
}
