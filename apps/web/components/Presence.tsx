type PresenceProps = {
  members: string[];
  currentName: string; // used to tag "(you)"
};

export function Presence({ members, currentName }: PresenceProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-neutral-300 p-4 dark:border-neutral-800">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Who&apos;s here</h2>
      <ul className="flex flex-col gap-1.5">
        {members.map((m, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 bg-foreground" />
            {m}
            {m === currentName && <span className="text-neutral-500">(you)</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
