import type { Card } from "@symposium/protocol";

type BoardProps = {
  cards: Card[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAddCard: () => void;
  disabled?: boolean; // frozen (left) → read-only
  onJoin?: () => void;
};

export function Board({ cards, draft, onDraftChange, onAddCard, disabled, onJoin }: BoardProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-neutral-300 dark:border-neutral-800">
      {disabled ? (
        <div className="flex items-center justify-between gap-2 border-b border-neutral-300 p-3 dark:border-neutral-800">
          <span className="text-xs text-neutral-500">You&apos;ve left — this is your last-seen board.</span>
          <button
            onClick={onJoin}
            className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
          >
            Join to add cards
          </button>
        </div>
      ) : (
        <div className="flex gap-2 border-b border-neutral-300 p-3 dark:border-neutral-800">
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddCard()}
            placeholder="New card — a source, note, or idea…"
            className="flex-1 border border-neutral-400 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-neutral-700"
          />
          <button
            onClick={onAddCard}
            className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background"
          >
            Add card
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {cards.length === 0 ? (
          <p className="text-sm text-neutral-500">The board is empty. Add the first card ↑</p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex flex-col border border-neutral-300 p-3 dark:border-neutral-800"
              >
                <p className="flex-1 text-sm break-words">{card.text}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-neutral-500">
                  by {card.createdBy} · #{card.seq}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
