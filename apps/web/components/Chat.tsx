import { useEffect, useRef } from "react";

export type ChatLine = { from: string; text: string };

type ChatProps = {
  messages: ChatLine[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean; // frozen (left) → read-only
  onJoin?: () => void;
};

export function Chat({ messages, draft, onDraftChange, onSend, disabled, onJoin }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // keep the newest message in view — this scroll concern belongs to Chat, so it lives here
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <aside className="flex w-72 shrink-0 flex-col">
      <h2 className="border-b border-neutral-300 px-4 py-3 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
        Chat
      </h2>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet. Say hi 👋</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((line, i) => (
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
      {disabled ? (
        <div className="border-t border-neutral-300 p-3 dark:border-neutral-800">
          <button
            onClick={onJoin}
            className="w-full border border-foreground px-3 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
          >
            Join to chat
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex gap-2 border-t border-neutral-300 p-3 dark:border-neutral-800"
        >
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Message…"
            className="flex-1 border border-neutral-400 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-neutral-700"
          />
          <button
            type="submit"
            className="border border-foreground px-3 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
          >
            Send
          </button>
        </form>
      )}
    </aside>
  );
}
