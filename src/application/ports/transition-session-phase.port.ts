import type { PhaseIdentifier } from "../../domain/game-session/game-session.types.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { PublicSessionStateDto } from "./create-game-session.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface TransitionSessionPhaseDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
}

export interface TransitionSessionPhaseCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
  readonly action: "advance" | "jump";
  readonly targetPhase?: PhaseIdentifier;
  readonly seed?: string;
}

export interface TransitionSessionPhaseResult {
  readonly state: PublicSessionStateDto;
}

export interface TransitionSessionPhaseUseCasePort {
  execute: (command: TransitionSessionPhaseCommand) => Promise<TransitionSessionPhaseResult>;
}
