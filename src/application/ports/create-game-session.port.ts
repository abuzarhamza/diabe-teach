import type {
  AdjudicationMode,
  PhaseIdentifier,
  SessionMode,
  SessionTimerConfig,
} from "../../domain/game-session/game-session.types.js";
import type { CapabilityTokenSignerPort } from "./capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface CreateGameSessionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
}

export interface CreateGameSessionCommand {
  readonly packId: string;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly timerConfig?: Partial<SessionTimerConfig>;
  readonly seed?: string;
  readonly creatorDisplayName?: string;
}

export interface PublicSessionStateDto {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly packId: string;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly currentPhase: PhaseIdentifier;
  readonly activeRoundNumber: 1 | 2 | null;
  readonly phaseStartedAt: string;
  readonly phaseEndsAt: string;
  readonly participantCount: number;
}

export interface CreateGameSessionResult {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly instructorToken: string;
  readonly participantId: string | null;
  readonly participantToken: string | null;
  readonly state: PublicSessionStateDto;
}

export interface CreateGameSessionUseCasePort {
  execute: (command: CreateGameSessionCommand) => Promise<CreateGameSessionResult>;
}
