import type { ClockPort } from "../ports/clock.port.js";
import type {
  ExtendSessionPhaseCommand,
  ExtendSessionPhaseDependencies,
  ExtendSessionPhaseResult,
  ExtendSessionPhaseUseCasePort,
} from "../ports/extend-session-phase.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SilentLogger } from "../services/silent-logger.js";

/** Gives the current timed phase more time (instructor only). */
export class ExtendSessionPhaseUseCase implements ExtendSessionPhaseUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: ExtendSessionPhaseDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo, deps.writeConflictBackoff);
    this.#clock = deps.clock;
  }

  public async execute(
    command: ExtendSessionPhaseCommand,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<ExtendSessionPhaseResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError("Only instructors can extend a session phase.");
    }

    const now = this.#clock.now();
    const session = await this.#sessionUpdates.run(SessionId.from(command.sessionId), (session) => {
      session.extendPhase(command.seconds, now);
      return session;
    }, { logger });
    logger.info(
      {
        sessionId: command.sessionId,
        phase: session.currentPhase,
        newEndsAt: session.phaseEndsAt?.toISOString() ?? null,
      },
      "session phase extended",
    );

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }
}
