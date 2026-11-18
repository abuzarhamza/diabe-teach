import type { PhaseIdentifier } from "../../domain/game-session/game-session.types.js";
import type { ClockPort } from "../ports/clock.port.js";
import type {
  TransitionSessionPhaseCommand,
  TransitionSessionPhaseDependencies,
  TransitionSessionPhaseResult,
  TransitionSessionPhaseUseCasePort,
} from "../ports/transition-session-phase.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { PHASE_TRANSITIONS } from "../../domain/game-session/game-session.types.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

export class TransitionSessionPhaseUseCase
implements TransitionSessionPhaseUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: TransitionSessionPhaseDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
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

    const now = this.#clock.now();

    // "advance" means "advance from the phase this request first saw". The
    // target is fixed on the first attempt, so a retry after a competing
    // advance is rejected as an invalid transition rather than skipping a phase.
    let targetPhase: PhaseIdentifier | undefined;
    let targetChosen = false;
    const session = await this.#sessionUpdates.run(
      SessionId.from(command.sessionId),
      (session) => {
        if (!targetChosen) {
          targetChosen = true;
          targetPhase = command.action === "advance"
            ? PHASE_TRANSITIONS.get(session.currentPhase)
            : command.targetPhase;
        }
        if (targetPhase) {
          session.transitionTo(targetPhase, now);
        }
        return session;
      },
    );

    const state = PublicSessionStateProjector.toDto(session);

    return { state };
  }
}
