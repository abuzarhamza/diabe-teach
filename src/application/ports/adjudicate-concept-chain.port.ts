import type { ChainVerdict, GridCoord, PeerVote } from "../../domain/game-session/concept-chain.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface AdjudicateConceptChainDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
}

export type AdjudicateAction
  = | "peer-approve"
    | "peer-challenge"
    | "ai-evaluate"
    | "instructor-approve"
    | "instructor-reject";

export interface AdjudicateConceptChainCommand {
  readonly sessionId: string;
  readonly roundNumber: 1 | 2;
  readonly chainId: string;
  readonly verifiedCapability: VerifiedCapability;
  readonly action: AdjudicateAction;
  readonly comment?: string;
  readonly feedback?: string;
  readonly qualityScore?: number;
}

export interface AdjudicatedChainDto {
  readonly chainId: string;
  readonly participantId: string;
  readonly roundNumber: 1 | 2;
  readonly path: readonly GridCoord[];
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly chainLength: number;
  readonly status: string;
  readonly peerVotes: readonly PeerVote[];
  readonly verdict: ChainVerdict | null;
  readonly submittedAt: string;
}

export interface AdjudicateConceptChainResult {
  readonly chain: AdjudicatedChainDto;
}

export interface AdjudicateConceptChainUseCasePort {
  execute: (command: AdjudicateConceptChainCommand) => Promise<AdjudicateConceptChainResult>;
}
