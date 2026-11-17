import type { GameSession } from "../../domain/game-session/game-session.js";
import type { PublicSessionStateDto } from "../ports/create-game-session.port.js";

export class PublicSessionStateProjector {
  public static toDto(session: GameSession): PublicSessionStateDto {
    return {
      sessionId: session.sessionId.value,
      roomCode: session.roomCode.value,
      packId: session.packId,
      mode: session.mode,
      adjudicationMode: session.adjudicationMode,
      currentPhase: session.currentPhase,
      activeRoundNumber: session.activeRoundNumber,
      phaseStartedAt: session.phaseStartedAt.toISOString(),
      phaseEndsAt: session.phaseEndsAt?.toISOString() ?? null,
      participantCount: session.participantCount,
    };
  }
}
