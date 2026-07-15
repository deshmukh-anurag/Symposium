// Who this browser is: either a real account (proven by a JWT the server minted at login)
// or a guest (just a name, unverified). Stored per-browser in localStorage.

const API_URL = "http://localhost:4000";
const WS_URL = "ws://localhost:4000";
const IDENTITY_KEY = "symposium.identity";

export type AuthUser = { id: string; email: string; name: string };

export type Identity =
  | { kind: "user"; token: string; user: AuthUser }
  | { kind: "guest"; name: string };

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function clearIdentity(): void {
  localStorage.removeItem(IDENTITY_KEY);
}

export function identityName(identity: Identity): string {
  return identity.kind === "user" ? identity.user.name : identity.name;
}

// The realtime server reads identity off the connect URL — browsers can't set WebSocket headers.
// A signed token proves who you are; a guest name is taken at face value.
export function wsUrlFor(identity: Identity): string {
  const query =
    identity.kind === "user"
      ? `token=${encodeURIComponent(identity.token)}`
      : `guest=${encodeURIComponent(identity.name)}`;
  return `${WS_URL}?${query}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // without this, express.json() skips the body
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`);
  }
  return data as T;
}

export function apiSignup(email: string, name: string, password: string): Promise<AuthUser> {
  return postJson<AuthUser>("/auth/signup", { email, name, password });
}

export function apiLogin(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return postJson<{ token: string; user: AuthUser }>("/auth/login", { email, password });
}
