import type { Card } from "@symposium/protocol";
import { Presence } from "./Presence";
import { Board } from "./Board";
import { Chat, type ChatLine } from "./Chat";

type RoomViewProps = {
  roomName: string;
  roomId: string;
  userName: string;
  frozen: boolean; // true = you've left; read-only last-seen view
  members: string[];
  cards: Card[];
  cardDraft: string;
  onCardDraftChange: (value: string) => void;
  onAddCard: () => void;
  chat: ChatLine[];
  chatDraft: string;
  onChatDraftChange: (value: string) => void;
  onSendChat: () => void;
  onLeave: () => void;
  onJoin: () => void;
};

export function RoomView({
  roomName,
  roomId,
  userName,
  frozen,
  members,
  cards,
  cardDraft,
  onCardDraftChange,
  onAddCard,
  chat,
  chatDraft,
  onChatDraftChange,
  onSendChat,
  onLeave,
  onJoin,
}: RoomViewProps) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-800">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{roomName}</span>
          <span className="font-mono text-xs text-neutral-500" title="Share this code so friends can join">
            #{roomId}
          </span>
          {frozen && <span className="text-xs text-neutral-500">· you left (viewing last-seen)</span>}
        </div>
        <div className="flex items-center gap-4">
          {frozen ? (
            <button
              onClick={onJoin}
              className="border border-foreground px-3 py-1 text-xs transition-colors hover:bg-foreground hover:text-background"
            >
              Join
            </button>
          ) : (
            <>
              <span className="text-xs text-neutral-500">{members.length} online</span>
              <button
                onClick={onLeave}
                className="border border-neutral-400 px-3 py-1 text-xs transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
              >
                Leave
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Presence members={members} currentName={userName} />
        <Board
          cards={cards}
          draft={cardDraft}
          onDraftChange={onCardDraftChange}
          onAddCard={onAddCard}
          disabled={frozen}
          onJoin={onJoin}
        />
        <Chat
          messages={chat}
          draft={chatDraft}
          onDraftChange={onChatDraftChange}
          onSend={onSendChat}
          disabled={frozen}
          onJoin={onJoin}
        />
      </div>
    </main>
  );
}
