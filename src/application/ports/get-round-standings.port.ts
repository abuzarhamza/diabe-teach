import type { VerifiedCapability } from "./capability-token.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface GetRoundStandingsDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
}

export interface GetRoundStandingsQuery {
  readonly sessionId: string;
  readonly roundNumber: 1 | 2;
  readonly verifiedCapability: VerifiedCapability;
}

export interface PlayerRoundStandingDto {
  readonly rank: number;
  readonly participantId: string;
  readonly displayName: string;
  readonly longestValidChainLength: number;
  readonly totalValidChainsCount: number;
  readonly approvedChainIds: readonly string[];
}

export interface GetRoundStandingsResult {
  readonly roundNumber: 1 | 2;
  readonly isFinalized: boolean;
  readonly standings: readonly PlayerRoundStandingDto[];
}

export interface GetRoundStandingsUseCasePort {
  execute: (query: GetRoundStandingsQuery) => Promise<GetRoundStandingsResult>;
}
