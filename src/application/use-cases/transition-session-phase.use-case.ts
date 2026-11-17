import type { ClockPort } from "../ports/clock.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  TransitionSessionPhaseCommand,
  TransitionSessionPhaseDependencies,
  TransitionSessionPhaseResult,
  TransitionSessionPhaseUseCasePort,
} from "../ports/transition-session-phase.port.js";
import {
  ForbiddenRoleError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { PHASE_TRANSITIONS } from "../../domain/game-session/game-session.types.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";

export class TransitionSessionPhaseUseCase
implements TransitionSessionPhaseUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #clock: ClockPort;

  public constructor(deps: TransitionSessionPhaseDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#clock = deps.clock;
  }

  public async execute(
    command: TransitionSessionPhaseCommand,
  ): Promise<TransitionSessionPhaseResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError(
        "Only instructors can transition session phases.",
      );
    }

    const sessionId = SessionId.from(command.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

    if (command.action === "advance") {
      const nextPhase = PHASE_TRANSITIONS.get(session.currentPhase);
      if (nextPhase) {
        session.transitionTo(nextPhase, this.#clock.now());
      }
    }
    else if (command.action === "jump" && command.targetPhase) {
      session.transitionTo(command.targetPhase, this.#clock.now());
    }

    await this.#sessionRepo.update(session);

    const state = PublicSessionStateProjector.toDto(session);

    return { state };
  }
}
