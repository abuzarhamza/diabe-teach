// Game Session calls (docs/api/openapi.yaml, tag Sessions). In-game routes send the session seat's
// Capability Token (BearerAuth), never the Account Token (ADR-0007).

import type { PhaseIdentifier } from "../domain/session-phase.ts";
import type { SessionSeat } from "./session-seat-store.ts";
import { ApiHttpError, apiRequest } from "./http-client.ts";
import { readSeat, saveSeat } from "./session-seat-store.ts";

// docs/api/openapi.yaml SessionParticipantView.
export interface SessionParticipantView {
  participantId: string;
  displayName: string;
  joinedAt: string;
  // null while the learner is still in the session.
  leftAt: string | null;
}

// docs/api/openapi.yaml PublicSessionState. `activeBoard` stays `unknown` until the Chain-Mapping View
// (react-web-ui 08) reads it.
export interface PublicSessionState {
  sessionId: string;
  roomCode: string;
  packId: string;
  packVersion?: string | null;
  mode: "solo" | "classroom" | "study-rct";
  adjudicationMode: "ai" | "peer-instructor" | "hybrid";
  currentPhase: PhaseIdentifier;
  activeRoundNumber?: 1 | 2 | null;
  phaseStartedAt: string;
  phaseEndsAt: string | null;
  activeBoard: unknown;
  participantCount: number;
  participants: SessionParticipantView[];
}

interface JoinSessionResponse {
  sessionId: string;
  participantId: string;
  participantToken: string;
  state: PublicSessionState;
}

export interface JoinedSession {
  seat: SessionSeat;
  state: PublicSessionState;
}

// POST /api/v1/sessions/join (200): no token. The room code is trimmed and upper-cased (as the server
// reads it) and the name trimmed. The learner's Capability Token seat is saved under the new sessionId.
export async function joinSession(roomCode: string, displayName: string): Promise<JoinedSession> {
  const name = displayName.trim();
  const response = await apiRequest<JoinSessionResponse>("POST", "/api/v1/sessions/join", {
    body: {
      roomCode: roomCode.trim().toUpperCase(),
      displayName: name,
    },
  });
  const seat = saveSeat({
    sessionId: response.sessionId,
    role: "participant",
    token: response.participantToken,
    participantId: response.participantId,
    displayName: name,
    roomCode: response.state.roomCode,
  });
  return { seat, state: response.state };
}

// GET /api/v1/sessions/{sessionId} (200) with this tab's seat for that session (instructor or participant).
export async function getSessionState(sessionId: string): Promise<PublicSessionState> {
  const seat = readSeat(sessionId);
  if (!seat)
    throw new ApiHttpError(401, "UNAUTHORIZED_TOKEN", "Join this game with its room code first.");
  const response = await apiRequest<{ state: PublicSessionState }>("GET", `/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    auth: { kind: "capability", token: seat.token },
  });
  return response.state;
}
