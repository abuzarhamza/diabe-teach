import type { PublicSessionStateDto } from "../ports/create-game-session.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  GetGameSessionStateDependencies,
  GetGameSessionStateQuery,
  GetGameSessionStateResult,
  GetGameSessionStateUseCasePort,
} from "../ports/get-game-session-state.port.js";
import { SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { DEFAULT_TIMER_CONFIG } from "../../domain/game-session/game-session.types.js";
import { SessionId } from "../../domain/game-session/session-id.js";

export class GetGameSessionStateUseCase
implements GetGameSessionStateUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(deps: GetGameSessionStateDependencies) {
    this.#sessionRepo = deps.sessionRepo;
  }

  public async execute(
    query: GetGameSessionStateQuery,
  ): Promise<GetGameSessionStateResult> {
    const sessionId = SessionId.from(query.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const phaseDuration = this.#getPhaseDuration(session.currentPhase);
    const phaseEndsAt = new Date(
      session.phaseStartedAt.getTime() + phaseDuration * 1000,
    );

    const state: PublicSessionStateDto = {
      sessionId: session.sessionId.value,
      roomCode: session.roomCode.value,
      packId: session.packId,
      mode: session.mode,
      adjudicationMode: session.adjudicationMode,
      currentPhase: session.currentPhase,
      activeRoundNumber: session.activeRoundNumber,
      phaseStartedAt: session.phaseStartedAt.toISOString(),
      phaseEndsAt: phaseEndsAt.toISOString(),
      participantCount: session.participantCount,
    };

    return { state };
  }

  #getPhaseDuration(phase: string): number {
    switch (phase) {
      case "pretest":
        return DEFAULT_TIMER_CONFIG.pretestSec;
      case "trial-orientation":
        return DEFAULT_TIMER_CONFIG.trialOrientationSec;
      case "round-1:chain-mapping":
      case "round-2:chain-mapping":
        return DEFAULT_TIMER_CONFIG.roundMappingSec;
      case "round-1:peer-adjudication":
      case "round-2:peer-adjudication":
        return DEFAULT_TIMER_CONFIG.roundAdjudicationSec;
      case "posttest":
        return DEFAULT_TIMER_CONFIG.posttestSec;
      case "feedback-survey":
        return DEFAULT_TIMER_CONFIG.feedbackSurveySec;
      default:
        return 0;
    }
  }
}
