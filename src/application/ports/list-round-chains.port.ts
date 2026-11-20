import type { ChainVerdict, GridCoord, PeerVote } from "../../domain/game-session/concept-chain.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface ListRoundChainsDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
}

export interface ListRoundChainsQuery {
  readonly sessionId: string;
  readonly roundNumber: 1 | 2;
  readonly verifiedCapability: VerifiedCapability;
}

/** A listed Concept Chain: the `SubmittedChain` shape of the API contract. */
export interface ListedChainDto {
  readonly chainId: string;
  readonly sessionId: string;
  readonly participantId: string;
  readonly roundNumber: 1 | 2;
  readonly path: readonly GridCoord[];
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly stepRationales: readonly string[];
  readonly chainLength: number;
  readonly status: string;
  readonly peerVotes: readonly PeerVote[];
  readonly verdict: ChainVerdict | null;
  readonly submittedAt: string;
}

export interface ListRoundChainsResult {
  readonly roundNumber: 1 | 2;
  readonly chains: readonly ListedChainDto[];
}

export interface ListRoundChainsUseCasePort {
  execute: (query: ListRoundChainsQuery) => Promise<ListRoundChainsResult>;
}
