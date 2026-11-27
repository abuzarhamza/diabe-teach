import type { GameSession } from "../../domain/game-session/game-session.js";
import type { SessionId } from "../../domain/game-session/session-id.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { WriteConflictBackoffPort } from "../ports/write-conflict-backoff.port.js";
import {
  ConcurrentUpdateConflictError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { SilentLogger } from "./silent-logger.js";

/** Options for one `run`. */
export interface GameSessionUpdateRunOptions {
  /**
   * A session the caller has just loaded (for example to read its
   * Curriculum Pack first); the first attempt uses it instead of loading
   * again. Later attempts always reload.
   */
  readonly loaded?: GameSession;
  /** The request's logger; each retry after a write conflict logs at `debug`. */
  readonly logger?: LoggerPort;
}

/**
 * Runs "load the Game Session → apply a command → save it" and, when the save
 * loses a concurrent-update race, waits a jittered backoff, reloads the
 * session and re-applies the command against the fresh state. Gives up after
 * MAX_ATTEMPTS attempts in total and rethrows the conflict. Nothing else is
 * retried.
 *
 * Backoff is exponential with full jitter: before attempt n + 1 it waits a
 * random time in [0, min(MAX_DELAY_MS, BASE_DELAY_MS * 2^(n - 1))). The worst
 * case for all retries together is 2.62 s of waiting plus ten load/save round
 * trips, well inside a deployed function's time limit (at least 10 s). Sized so 25 learners
 * writing at the same moment all commit even when one load + save takes about
 * 20 ms (Mongo), not only in memory. Without a backoff port (tests that build
 * their own dependencies) it retries at once.
 *
 * The command must be synchronous (the save follows as soon as it returns) and
 * may run more than once, so it must not commit side effects before the save. Read the clock before calling `run`, not inside the command.
 */
export class GameSessionUpdateRetrier {
  /** Enough for a 25-learner class acting at the same moment (see the chaos stampede test). */
  public static readonly MAX_ATTEMPTS = 10;
  public static readonly BASE_DELAY_MS = 20;
  public static readonly MAX_DELAY_MS = 500;

  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #backoff: WriteConflictBackoffPort | undefined;

  public constructor(sessionRepo: GameSessionRepositoryPort, backoff?: WriteConflictBackoffPort) {
    this.#sessionRepo = sessionRepo;
    this.#backoff = backoff;
  }

  /**
   * The full-jitter wait after attempt `failedAttempt` (1-based) lost the
   * race: `random` (in [0, 1)) times the capped exponential ceiling, in whole ms.
   */
  public static delayAfterConflictMs(failedAttempt: number, random: number): number {
    const ceiling = Math.min(
      GameSessionUpdateRetrier.MAX_DELAY_MS,
      GameSessionUpdateRetrier.BASE_DELAY_MS * 2 ** (failedAttempt - 1),
    );
    return Math.floor(random * ceiling);
  }

  public async run<TResult>(
    sessionId: SessionId,
    command: (session: GameSession) => TResult,
    options: GameSessionUpdateRunOptions = {},
  ): Promise<TResult> {
    const { loaded, logger = new SilentLogger() } = options;
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
        const delayMs = this.#backoff
          ? GameSessionUpdateRetrier.delayAfterConflictMs(attempt, this.#backoff.random())
          : 0;
        logger.debug(
          { sessionId: sessionId.value, attempt: attempt + 1, delayMs },
          "session write conflict; retrying",
        );
        if (this.#backoff) {
          await this.#backoff.sleep(delayMs);
        }
      }
    }
  }
}
