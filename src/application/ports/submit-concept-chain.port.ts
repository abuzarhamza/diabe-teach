import type { GridCoord } from "../../domain/game-session/concept-chain.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface SubmitConceptChainDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  /** Supplies the minimum chain length, from the session's pinned Pack Version. */
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly clock: ClockPort;
}

export interface SubmitConceptChainCommand {
  readonly sessionId: string;
  readonly roundNumber: 1 | 2;
  readonly verifiedCapability: VerifiedCapability;
  readonly path: readonly GridCoord[];
  /**
   * Keyword ids claimed by the client. Ignored when the round has a dealt
   * board (the ids come from the board); kept only for legacy sessions.
   */
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly stepRationales?: readonly string[];
}

export interface SubmittedChainDto {
  readonly chainId: string;
  readonly participantId: string;
  readonly roundNumber: 1 | 2;
  readonly path: readonly GridCoord[];
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly chainLength: number;
  readonly status: string;
  readonly submittedAt: string;
}

export interface SubmitConceptChainResult {
  readonly chain: SubmittedChainDto;
}

export interface SubmitConceptChainUseCasePort {
  execute: (command: SubmitConceptChainCommand) => Promise<SubmitConceptChainResult>;
}
