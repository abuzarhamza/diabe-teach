import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface LeaveGameSessionDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly clock: ClockPort;
}

export interface LeaveGameSessionCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
}

export interface LeaveGameSessionResult {
  readonly state: PublicSessionStateDto;
}

export interface LeaveGameSessionUseCasePort {
  execute: (command: LeaveGameSessionCommand) => Promise<LeaveGameSessionResult>;
}
