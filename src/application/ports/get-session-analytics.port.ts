import type { SessionAnalyticsResponse } from "../dtos/session-analytics.dto.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface GetSessionAnalyticsDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
}

export interface GetSessionAnalyticsQuery {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
}

export type GetSessionAnalyticsResult = SessionAnalyticsResponse;

export interface GetSessionAnalyticsUseCasePort {
  execute: (query: GetSessionAnalyticsQuery) => Promise<GetSessionAnalyticsResult>;
}
