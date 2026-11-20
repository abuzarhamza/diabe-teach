import type { ClockPort } from "../ports/clock.port.js";
import type {
  EndGameSessionCommand,
  EndGameSessionDependencies,
  EndGameSessionResult,
  EndGameSessionUseCasePort,
} from "../ports/end-game-session.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

/** Ends the Game Session early, from any phase (instructor only). */
export class EndGameSessionUseCase implements EndGameSessionUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: EndGameSessionDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#clock = deps.clock;
  }

  public async execute(command: EndGameSessionCommand): Promise<EndGameSessionResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError("Only instructors can end a session.");
    }

    const now = this.#clock.now();
    const session = await this.#sessionUpdates.run(SessionId.from(command.sessionId), (session) => {
      session.endSession(now);
      return session;
    });

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }
}
