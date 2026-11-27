import type { SessionSeat } from "../../api/session-seat-store.ts";
import { useSyncExternalStore } from "react";
import { readSeatSnapshot, seatFromSnapshot, subscribeToSeats } from "../../api/session-seat-store.ts";

// This tab's Capability Token seat for a Game Session, or null when it has not joined (or created) it.
// Re-renders when a seat changes in this tab; no useEffect.
export function useSessionSeat(sessionId: string): SessionSeat | null {
  const snapshot = useSyncExternalStore(subscribeToSeats, () => readSeatSnapshot(sessionId));
  return seatFromSnapshot(snapshot);
}
