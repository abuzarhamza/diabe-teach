import type { GameSession } from "../../domain/game-session/game-session.js";
import type { SessionId } from "../../domain/game-session/session-id.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import {
  ConcurrentUpdateConflictError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";

/**
 * Runs "load the Game Session → apply a command → save it" and, when the save
 * loses a concurrent-update race, reloads the session and re-applies the
 * command against the fresh state. Gives up after MAX_ATTEMPTS attempts in
 * total and rethrows the conflict. Nothing else is retried.
 *
 * The command must be synchronous (the save follows as soon as it returns) and
 * may run more than once, so it must not commit side effects before the save. Read the clock before calling `run`, not inside the command.
 */
export class GameSessionUpdateRetrier {
  public static readonly MAX_ATTEMPTS = 3;

  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(sessionRepo: GameSessionRepositoryPort) {
    this.#sessionRepo = sessionRepo;
  }

  /**
   * `loaded` is a session the caller has just loaded (for example to read its
   * Curriculum Pack first); the first attempt uses it instead of loading again.
   * Later attempts always reload.
   */
  public async run<TResult>(
    sessionId: SessionId,
    command: (session: GameSession) => TResult,
    loaded?: GameSession,
  ): Promise<TResult> {
    for (let attempt = 1; ; attempt++) {
      // Reload every retry: a successful save does not bump the version on
      // the object we hold, and a conflict means the stored state moved on.
      const session = attempt === 1 && loaded !== undefined
        ? loaded
        : await this.#sessionRepo.findById(sessionId);
      if (!session) {
        throw new SessionNotFoundError(sessionId.value);
      }

      const result = command(session);

      try {
        await this.#sessionRepo.update(session);
        return result;
      }
      catch (error) {
        if (
          !(error instanceof ConcurrentUpdateConflictError)
          || attempt >= GameSessionUpdateRetrier.MAX_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
