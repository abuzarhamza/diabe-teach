// The Session Seat store: the per-session Capability Token seats this browser tab holds, kept in
// sessionStorage under its own key, one entry per sessionId, so joining a second Game Session never
// overwrites the first. It is a separate store from account-token-store.ts: the Account Token is never
// kept here and a Capability Token is never kept there (ADR-0007).
//
// sessionStorage (as the prototype's learner screen did) makes each tab its own seat: two tabs of one
// browser can join the same Game Session as two learners, and a reload keeps the seat.
//
// Screens read a seat with useSyncExternalStore(subscribeToSeats, () => readSeatSnapshot(sessionId)) and
// turn the snapshot into the seat with seatFromSnapshot during render. The snapshot is that seat's JSON
// string, or null, so it stays the same value between changes, as useSyncExternalStore requires.

import type { SessionRole } from "../domain/session-phase.ts";

export const SESSION_SEATS_KEY = "cc-session-seats-v1";

export interface SessionSeat {
  sessionId: string;
  role: SessionRole;
  // The Capability Token for this Game Session (instructorToken or participantToken).
  token: string;
  // null for the instructor seat of a classroom game.
  participantId: string | null;
  displayName: string | null;
  roomCode: string;
}

// sessionStorage raises no `storage` event in its own tab, so changes notify these listeners directly.
const listeners = new Set<() => void>();

function parseJson(text: string | null): unknown {
  if (text === null)
    return null;
  try {
    return JSON.parse(text);
  }
  catch {
    return null;
  }
}

function readSeats(): Record<string, unknown> {
  const value = parseJson(sessionStorage.getItem(SESSION_SEATS_KEY));
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function saveSeat(seat: SessionSeat): SessionSeat {
  const stored: SessionSeat = {
    sessionId: seat.sessionId,
    role: seat.role,
    token: seat.token,
    participantId: seat.participantId,
    displayName: seat.displayName,
    roomCode: seat.roomCode,
  };
  sessionStorage.setItem(SESSION_SEATS_KEY, JSON.stringify({
    ...readSeats(),
    [seat.sessionId]: stored,
  }));
  listeners.forEach(listener => listener());
  return stored;
}

// Forgets this tab's seat for one Game Session (Leave, "Not you?"); other sessions' seats stay.
export function clearSeat(sessionId: string): void {
  const { [sessionId]: _removed, ...rest } = readSeats();
  sessionStorage.setItem(SESSION_SEATS_KEY, JSON.stringify(rest));
  listeners.forEach(listener => listener());
}

export function readSeatSnapshot(sessionId: string): string | null {
  const seat = readSeats()[sessionId];
  return seat === undefined
    ? null
    : JSON.stringify(seat);
}

export function readSeat(sessionId: string): SessionSeat | null {
  return seatFromSnapshot(readSeatSnapshot(sessionId));
}

// Calls onChange when a seat changes in this tab. Returns the unsubscribe function.
export function subscribeToSeats(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// The seat, or null when nothing is stored or the value is not a readable seat.
export function seatFromSnapshot(snapshot: string | null): SessionSeat | null {
  const value = parseJson(snapshot);
  if (!value || typeof value !== "object")
    return null;
  const { sessionId, role, token, participantId, displayName, roomCode } = value as Record<string, unknown>;
  if (typeof sessionId !== "string" || typeof token !== "string" || !token || typeof roomCode !== "string")
    return null;
  if (role !== "instructor" && role !== "participant")
    return null;
  if (!isStringOrNull(participantId) || !isStringOrNull(displayName))
    return null;
  return {
    sessionId,
    role,
    token,
    participantId,
    displayName,
    roomCode,
  };
}
