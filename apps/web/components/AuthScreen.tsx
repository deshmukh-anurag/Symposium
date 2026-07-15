import { useState } from "react";
import { apiLogin, apiSignup, type Identity } from "@/lib/auth";

type AuthScreenProps = {
  notice: string; // e.g. "your session expired"
  onAuthenticated: (identity: Identity) => void;
};

type Mode = "login" | "signup";

const inputClass =
  "border border-neutral-400 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-neutral-700";

export function AuthScreen({ notice, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      // signup only creates the account — it returns no token, so we log in right after to get one
      if (mode === "signup") {
        await apiSignup(email.trim(), name.trim(), password);
      }
      const { token, user } = await apiLogin(email.trim(), password);
      onAuthenticated({ kind: "user", token, user });
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't reach the server");
    } finally {
      setBusy(false);
    }
  }

  function continueAsGuest() {
    const trimmed = guestName.trim();
    if (!trimmed) return setError("Enter a name to continue as a guest.");
    onAuthenticated({ kind: "guest", name: trimmed });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight">SYMPOSIUM</h1>
          <p className="mt-1 text-sm text-neutral-500">Research with friends — live.</p>
        </div>

        {notice && <p className="bg-foreground px-3 py-2 text-sm text-background">{notice}</p>}

        <div className="border border-neutral-300 dark:border-neutral-800">
          <div className="grid grid-cols-2 divide-x divide-neutral-300 border-b border-neutral-300 dark:divide-neutral-800 dark:border-neutral-800">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors ${
                  mode === m
                    ? "bg-foreground text-background"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>

            {mode === "signup" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-neutral-500">Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="how others see you in a room"
                  className={inputClass}
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                placeholder={mode === "signup" ? "at least 8 characters" : ""}
                className={inputClass}
              />
            </label>

            <button
              onClick={submit}
              disabled={busy}
              className="border border-foreground px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
            >
              {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </div>
        </div>

        <div className="border border-neutral-300 dark:border-neutral-800">
          <h2 className="border-b border-neutral-300 px-4 py-2 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            Just visiting
          </h2>
          <div className="flex gap-2 p-4">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && continueAsGuest()}
              placeholder="your name"
              className={`flex-1 ${inputClass}`}
            />
            <button
              onClick={continueAsGuest}
              className="shrink-0 border border-neutral-400 px-4 py-2 text-sm transition-colors hover:bg-foreground hover:text-background dark:border-neutral-700"
            >
              Continue as guest
            </button>
          </div>
        </div>

        {error && <p className="bg-foreground px-3 py-2 text-sm text-background">{error}</p>}
      </div>
    </main>
  );
}
