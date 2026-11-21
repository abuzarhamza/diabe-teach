import type { ClockPort } from "../ports/clock.port.js";
import type {
  EndGameSessionCommand,
  EndGameSessionDependencies,
  EndGameSessionResult,
  EndGameSessionUseCasePort,
} from "../ports/end-game-session.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SilentLogger } from "../services/silent-logger.js";

/** Ends the Game Session early, from any phase (instructor only). */
export class EndGameSessionUseCase implements EndGameSessionUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: EndGameSessionDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#clock = deps.clock;
  }

  public async execute(
    command: EndGameSessionCommand,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<EndGameSessionResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError("Only instructors can end a session.");
    }

    const now = this.#clock.now();
    let fromPhase: string | undefined;
    const session = await this.#sessionUpdates.run(SessionId.from(command.sessionId), (session) => {
      fromPhase = session.currentPhase;
      session.endSession(now);
      return session;
    }, { logger });
    logger.info({ sessionId: command.sessionId, fromPhase }, "session ended");

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }
}
