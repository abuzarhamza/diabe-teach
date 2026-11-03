import type { GridCoord } from "../../domain/game-session/concept-chain.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface SubmitConceptChainDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly minChainLength?: number;
}

export interface SubmitConceptChainCommand {
  readonly sessionId: string;
  readonly roundNumber: 1 | 2;
  readonly verifiedCapability: VerifiedCapability;
  readonly path: readonly GridCoord[];
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
