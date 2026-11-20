import type { VerifiedCapability } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface ExtendSessionPhaseDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly clock: ClockPort;
}

export interface ExtendSessionPhaseCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
  /** Whole seconds to add, from 1 to 600. */
  readonly seconds: number;
}

export interface ExtendSessionPhaseResult {
  readonly state: PublicSessionStateDto;
}

export interface ExtendSessionPhaseUseCasePort {
  execute: (command: ExtendSessionPhaseCommand) => Promise<ExtendSessionPhaseResult>;
}
