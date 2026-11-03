import type { CapabilityTokenSignerPort } from "./capability-token.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface JoinGameSessionDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
}

export interface JoinGameSessionCommand {
  readonly roomCode: string;
  readonly displayName?: string;
}

export interface JoinGameSessionResult {
  readonly sessionId: string;
  readonly participantId: string;
  readonly participantToken: string;
  readonly state: PublicSessionStateDto;
}

export interface JoinGameSessionUseCasePort {
  execute: (command: JoinGameSessionCommand) => Promise<JoinGameSessionResult>;
}
