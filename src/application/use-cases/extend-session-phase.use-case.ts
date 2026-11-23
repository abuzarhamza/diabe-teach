import type { ClockPort } from "../ports/clock.port.js";
import type {
  ExtendSessionPhaseCommand,
  ExtendSessionPhaseDependencies,
  ExtendSessionPhaseResult,
  ExtendSessionPhaseUseCasePort,
} from "../ports/extend-session-phase.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

/** Gives the current timed phase more time (instructor only). */
export class ExtendSessionPhaseUseCase implements ExtendSessionPhaseUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: ExtendSessionPhaseDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#clock = deps.clock;
  }

  public async execute(command: ExtendSessionPhaseCommand): Promise<ExtendSessionPhaseResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError("Only instructors can extend a session phase.");
    }

    const now = this.#clock.now();
    const session = await this.#sessionUpdates.run(SessionId.from(command.sessionId), (session) => {
      session.extendPhase(command.seconds, now);
      return session;
    });

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }
}
