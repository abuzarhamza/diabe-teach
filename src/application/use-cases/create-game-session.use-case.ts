import type { CapabilityTokenSignerPort } from "../ports/capability-token.port.js";
import type {
  CreateGameSessionCommand,
  CreateGameSessionDependencies,
  CreateGameSessionResult,
  CreateGameSessionUseCasePort,
  PublicSessionStateDto,
} from "../ports/create-game-session.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { PackNotFoundError } from "../../domain/errors/domain-errors.js";
import { GameSession } from "../../domain/game-session/game-session.js";
import { DEFAULT_TIMER_CONFIG } from "../../domain/game-session/game-session.types.js";

export class CreateGameSessionUseCase implements CreateGameSessionUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #tokenSigner: CapabilityTokenSignerPort;

  public constructor(deps: CreateGameSessionDependencies) {
    this.#packRepo = deps.packRepo;
    this.#sessionRepo = deps.sessionRepo;
    this.#tokenSigner = deps.tokenSigner;
  }

  public async execute(
    command: CreateGameSessionCommand,
  ): Promise<CreateGameSessionResult> {
    const packId = PackId.create(command.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(command.packId);
    }

    const session = GameSession.create({
      packId: command.packId,
      mode: command.mode,
      adjudicationMode: command.adjudicationMode,
      timerConfig: command.timerConfig,
    });

    let participantId: string | null = null;
    let participantToken: string | null = null;

    if (command.mode === "solo") {
      const participant = session.addParticipant(
        command.creatorDisplayName ?? "Player",
      );
      participantId = participant.participantId;
      participantToken = await this.#tokenSigner.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });
    }

    await this.#sessionRepo.create(session);

    const instructorToken = await this.#tokenSigner.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const timerConfig = {
      ...DEFAULT_TIMER_CONFIG,
      ...command.timerConfig,
    };
    const phaseDuration = this.#getPhaseDuration(
      session.currentPhase,
      timerConfig,
    );
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
      roomCode: session.roomCode.value,
      instructorToken,
      participantId,
      participantToken,
      state,
    };
  }

  #getPhaseDuration(
    phase: string,
    timerConfig: typeof DEFAULT_TIMER_CONFIG,
  ): number {
    switch (phase) {
      case "pretest":
        return timerConfig.pretestSec;
      case "trial-orientation":
        return timerConfig.trialOrientationSec;
      case "round-1:chain-mapping":
      case "round-2:chain-mapping":
        return timerConfig.roundMappingSec;
      case "round-1:peer-adjudication":
      case "round-2:peer-adjudication":
        return timerConfig.roundAdjudicationSec;
      case "posttest":
        return timerConfig.posttestSec;
      case "feedback-survey":
        return timerConfig.feedbackSurveySec;
      default:
        return 0;
    }
  }
}
