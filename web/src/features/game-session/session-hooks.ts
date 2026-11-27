import type { ApiHttpError } from "../../api/http-client.ts";
import type { JoinedSession, PublicSessionState } from "../../api/sessions-api.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSessionState, joinSession } from "../../api/sessions-api.ts";
import { useSessionSeat } from "./use-session-seat.ts";

// The only game-session file that uses TanStack Query. Screens call these hooks by what they do;
// each returns TanStack's result object (`data`, `error`, `isPending`, `mutate`, ...).

// How often the Session Shell asks for the state: the class moves together within 2 seconds.
export const SESSION_POLL_MS = 2000;

export interface JoinRequest {
  roomCode: string;
  displayName: string;
}

export interface JoinCallbacks {
  onSuccess: (joined: JoinedSession) => void;
}

// Join a Game Session by room code: POST /api/v1/sessions/join. Saves the learner's seat on success.
export function useJoinSession({ onSuccess }: JoinCallbacks) {
  return useMutation<JoinedSession, ApiHttpError, JoinRequest>({
    // The call `mutate({ roomCode, displayName })` makes.
    mutationFn: ({ roomCode, displayName }) => joinSession(roomCode, displayName),
    // Runs once the API accepts the join and the seat is stored.
    onSuccess,
  });
}

// The Game Session state, polled every 2 seconds while the Session Shell shows (no useEffect, no SSE).
export function useSessionState(sessionId: string) {
  const seat = useSessionSeat(sessionId);
  return useQuery<PublicSessionState, ApiHttpError>({
    // The cache name. The seat's token is in it so a new seat for the session is asked about afresh.
    queryKey: [
      "sessions",
      sessionId,
      "state",
      seat?.token,
    ],
    // The call that fetches the state with the seat's Capability Token.
    queryFn: () => getSessionState(sessionId),
    // Ask only while this tab holds a seat for the session.
    enabled: seat !== null,
    refetchInterval: SESSION_POLL_MS,
  });
}
