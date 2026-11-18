import type { CapabilityTokenSignerPort } from "../ports/capability-token.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type {
  CreateGameSessionCommand,
  CreateGameSessionDependencies,
  CreateGameSessionResult,
  CreateGameSessionUseCasePort,
} from "../ports/create-game-session.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { PackNotFoundError } from "../../domain/errors/domain-errors.js";
import { GameSession } from "../../domain/game-session/game-session.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";

export class CreateGameSessionUseCase implements CreateGameSessionUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #tokenSigner: CapabilityTokenSignerPort;
  readonly #clock: ClockPort;

  public constructor(deps: CreateGameSessionDependencies) {
    this.#packRepo = deps.packRepo;
    this.#sessionRepo = deps.sessionRepo;
    this.#tokenSigner = deps.tokenSigner;
    this.#clock = deps.clock;
  }

  public async execute(
    command: CreateGameSessionCommand,
  ): Promise<CreateGameSessionResult> {
    const packId = PackId.create(command.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(command.packId);
    }

    const now = this.#clock.now();
    const session = GameSession.create({
      packId: command.packId,
      mode: command.mode,
      adjudicationMode: command.adjudicationMode,
      timerConfig: command.timerConfig,
      phaseStartedAt: now,
      createdAt: now,
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

    const state = PublicSessionStateProjector.toDto(session);

    return {
      sessionId: session.sessionId.value,
      roomCode: session.roomCode.value,
      instructorToken,
      participantId,
      participantToken,
      state,
    };
  }
}
