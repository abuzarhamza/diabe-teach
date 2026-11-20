import type { ClockPort } from "../ports/clock.port.js";
import type {
  LeaveGameSessionCommand,
  LeaveGameSessionDependencies,
  LeaveGameSessionResult,
  LeaveGameSessionUseCasePort,
} from "../ports/leave-game-session.port.js";
import { ForbiddenRoleError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

/** A learner leaves the Game Session (participant only; leaving again is a no-op). */
export class LeaveGameSessionUseCase implements LeaveGameSessionUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #clock: ClockPort;

  public constructor(deps: LeaveGameSessionDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#clock = deps.clock;
  }

  public async execute(command: LeaveGameSessionCommand): Promise<LeaveGameSessionResult> {
    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can leave a session.");
    }
    const participantId = command.verifiedCapability.participantId;
    if (!participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    const now = this.#clock.now();
    const session = await this.#sessionUpdates.run(SessionId.from(command.sessionId), (session) => {
      session.leave(participantId, now);
      return session;
    });

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }
}
