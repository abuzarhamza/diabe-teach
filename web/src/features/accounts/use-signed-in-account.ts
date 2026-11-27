import type { StoredAccount } from "../../api/account-token-store.ts";
import { useSyncExternalStore } from "react";
import { accountFromSnapshot, readStoredAccountSnapshot, subscribeToStoredAccount } from "../../api/account-token-store.ts";

// The signed-in teacher from the Account Token store, or null when signed out (missing, malformed or
// expired token). Re-renders when the token changes in this tab or another (the `storage` event); no useEffect.
export function useSignedInAccount(): StoredAccount | null {
  const snapshot = useSyncExternalStore(subscribeToStoredAccount, readStoredAccountSnapshot);
  return accountFromSnapshot(snapshot);
}
