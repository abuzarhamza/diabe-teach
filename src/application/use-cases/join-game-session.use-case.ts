import type { CapabilityTokenSignerPort } from "../ports/capability-token.port.js";
import type { PublicSessionStateDto } from "../ports/create-game-session.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  JoinGameSessionCommand,
  JoinGameSessionDependencies,
  JoinGameSessionResult,
  JoinGameSessionUseCasePort,
} from "../ports/join-game-session.port.js";
import { RoomCodeNotFoundError } from "../../domain/errors/domain-errors.js";
import { DEFAULT_TIMER_CONFIG } from "../../domain/game-session/game-session.types.js";
import { RoomCode } from "../../domain/game-session/room-code.js";

export class JoinGameSessionUseCase implements JoinGameSessionUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #tokenSigner: CapabilityTokenSignerPort;

  public constructor(deps: JoinGameSessionDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#tokenSigner = deps.tokenSigner;
  }

  public async execute(
    command: JoinGameSessionCommand,
  ): Promise<JoinGameSessionResult> {
    const roomCode = RoomCode.from(command.roomCode);
    const session = await this.#sessionRepo.findByRoomCode(roomCode);

    if (!session) {
      throw new RoomCodeNotFoundError(command.roomCode);
    }

    const participant = session.addParticipant(
      command.displayName ?? "Anonymous",
    );

    await this.#sessionRepo.update(session);

    const participantToken = await this.#tokenSigner.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

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

    return {
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
      participantToken,
      state,
    };
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
