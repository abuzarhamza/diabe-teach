import type { PhaseIdentifier } from "../../domain/game-session/game-session.types.js";
import type { BoardSeedGeneratorPort, SeededRandomPort } from "./board-randomness.port.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type { WriteConflictBackoffPort } from "./write-conflict-backoff.port.js";

export interface TransitionSessionPhaseDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly clock: ClockPort;
  readonly seededRandom: SeededRandomPort;
  readonly seedGenerator: BoardSeedGeneratorPort;
  /** Waits between write-conflict retries; without one the retrier retries at once. */
  readonly writeConflictBackoff?: WriteConflictBackoffPort;
}

export interface TransitionSessionPhaseCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
  readonly action: "advance" | "jump";
  readonly targetPhase?: PhaseIdentifier;
  /**
   * Seeds the board of the round being entered (overriding the creation seed
   * for Round 1). Ignored when the transition enters no round.
   */
  readonly seed?: string;
}

export interface TransitionSessionPhaseResult {
  readonly state: PublicSessionStateDto;
}

export interface TransitionSessionPhaseUseCasePort {
  execute: (command: TransitionSessionPhaseCommand, logger?: LoggerPort) => Promise<TransitionSessionPhaseResult>;
}
