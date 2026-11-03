import type { VerifiedCapability } from "./capability-token.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface GetGameSessionStateDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
}

export interface GetGameSessionStateQuery {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
}

export interface GetGameSessionStateResult {
  readonly state: PublicSessionStateDto;
}

export interface GetGameSessionStateUseCasePort {
  execute: (query: GetGameSessionStateQuery) => Promise<GetGameSessionStateResult>;
}
