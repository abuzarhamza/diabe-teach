import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type { WriteConflictBackoffPort } from "./write-conflict-backoff.port.js";

export interface ExtendSessionPhaseDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly clock: ClockPort;
  /** Waits between write-conflict retries; without one the retrier retries at once. */
  readonly writeConflictBackoff?: WriteConflictBackoffPort;
}

export interface ExtendSessionPhaseCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
  /** Whole seconds to add, from 1 to 600. */
  readonly seconds: number;
}

export interface ExtendSessionPhaseResult {
  readonly state: PublicSessionStateDto;
}

export interface ExtendSessionPhaseUseCasePort {
  execute: (command: ExtendSessionPhaseCommand, logger?: LoggerPort) => Promise<ExtendSessionPhaseResult>;
}
