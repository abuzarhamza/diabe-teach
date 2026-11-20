import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface EndGameSessionDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly clock: ClockPort;
}

export interface EndGameSessionCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
}

export interface EndGameSessionResult {
  readonly state: PublicSessionStateDto;
}

export interface EndGameSessionUseCasePort {
  execute: (command: EndGameSessionCommand) => Promise<EndGameSessionResult>;
}
