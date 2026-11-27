// The Account Token store: the signed-in teacher's AccountTokenResponse, kept in localStorage.
// The key is the prototype's (claudPoc/concept-chain/account-api.js), so a teacher signed in there stays
// signed in here. It is the Account Token's own key: Capability Tokens are never kept under it (ADR-0007).
//
// Screens read it with useSyncExternalStore(subscribeToStoredAccount, readStoredAccountSnapshot) and turn
// the snapshot into the teacher with accountFromSnapshot during render. The snapshot is the raw stored
// string while it holds a valid, unexpired account and null otherwise, so it stays the same value between
// changes, as useSyncExternalStore requires, and turns null when the token expires.

export const ACCOUNT_TOKEN_KEY = "cc-account-token-v1";

export interface StoredAccount {
  accountId: string;
  email: string;
  accountToken: string;
  expiresAt: string;
}

// The `storage` event only reaches *other* tabs, so changes made in this tab notify these listeners directly.
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

export function saveAccount(response: StoredAccount): StoredAccount {
  const account: StoredAccount = {
    accountId: response.accountId,
    email: response.email,
    accountToken: response.accountToken,
    expiresAt: response.expiresAt,
  };
  localStorage.setItem(ACCOUNT_TOKEN_KEY, JSON.stringify(account));
  notifyListeners();
  return account;
}

// Sign out: the Account Token is removed from this browser (other tabs follow through the `storage` event).
export function clearAccount(): void {
  localStorage.removeItem(ACCOUNT_TOKEN_KEY);
  notifyListeners();
}

export function readStoredAccountSnapshot(): string | null {
  const snapshot = localStorage.getItem(ACCOUNT_TOKEN_KEY);
  return accountFromSnapshot(snapshot)
    ? snapshot
    : null;
}

// setTimeout's longest delay (about 24.8 days); a later expiry is reached in more than one step.
const MAX_TIMER_DELAY_MS = 2_147_483_647;

// Calls onChange when the Account Token changes in this tab or another one (`key` is null when another tab
// clears all of localStorage), and when the stored token reaches its expiresAt while the screen stays open.
// Returns the unsubscribe function.
export function subscribeToStoredAccount(onChange: () => void): () => void {
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  function watchExpiry() {
    clearTimeout(expiryTimer);
    const account = accountFromSnapshot(localStorage.getItem(ACCOUNT_TOKEN_KEY));
    if (account)
      expiryTimer = setTimeout(changed, Math.min(Date.parse(account.expiresAt) - Date.now(), MAX_TIMER_DELAY_MS));
  }
  function changed() {
    watchExpiry();
    onChange();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === ACCOUNT_TOKEN_KEY || event.key === null)
      changed();
  }
  listeners.add(changed);
  window.addEventListener("storage", onStorage);
  watchExpiry();
  return () => {
    clearTimeout(expiryTimer);
    listeners.delete(changed);
    window.removeEventListener("storage", onStorage);
  };
}

// Why no teacher is signed in: "missing" (nothing stored, or not a readable account) or "expired"
// (a readable account past its expiresAt); null when a valid Account Token is stored.
export type SignedOutCause = "missing" | "expired";

export function signedOutCause(now: number = Date.now()): SignedOutCause | null {
  const snapshot = localStorage.getItem(ACCOUNT_TOKEN_KEY);
  if (accountFromSnapshot(snapshot, now))
    return null;
  return snapshot !== null && accountFromSnapshot(snapshot, Number.NEGATIVE_INFINITY)
    ? "expired"
    : "missing";
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  }
  catch {
    return null;
  }
}

// The signed-in teacher, or null when nothing is stored, the value is malformed, or it is past expiresAt.
export function accountFromSnapshot(snapshot: string | null, now: number = Date.now()): StoredAccount | null {
  if (snapshot === null)
    return null;
  const value = parseJson(snapshot);
  if (!value || typeof value !== "object")
    return null;
  const { accountId, email, accountToken, expiresAt } = value as Record<string, unknown>;
  if (typeof accountId !== "string" || typeof email !== "string" || typeof accountToken !== "string" || typeof expiresAt !== "string")
    return null;
  if (!accountToken || !(Date.parse(expiresAt) > now))
    return null;
  return {
    accountId,
    email,
    accountToken,
    expiresAt,
  };
}
