import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type { WriteConflictBackoffPort } from "./write-conflict-backoff.port.js";

export interface EndGameSessionDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly clock: ClockPort;
  /** Waits between write-conflict retries; without one the retrier retries at once. */
  readonly writeConflictBackoff?: WriteConflictBackoffPort;
}

export interface EndGameSessionCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
}

export interface EndGameSessionResult {
  readonly state: PublicSessionStateDto;
}

export interface EndGameSessionUseCasePort {
  execute: (command: EndGameSessionCommand, logger?: LoggerPort) => Promise<EndGameSessionResult>;
}
