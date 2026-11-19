import type {
  AdjudicationMode,
  PhaseIdentifier,
  SessionMode,
  SessionTimerConfig,
} from "../../domain/game-session/game-session.types.js";
import type { BoardGridViewDto } from "../dtos/board-grid-view.dto.js";
import type { CapabilityTokenSignerPort } from "./capability-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface CreateGameSessionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
  readonly clock: ClockPort;
}

export interface CreateGameSessionCommand {
  readonly packId: string;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly timerConfig?: Partial<SessionTimerConfig>;
  /** Seeds Round 1's board (unless the transition into Round 1 sends its own). */
  readonly seed?: string;
  readonly creatorDisplayName?: string;
}

export interface PublicSessionStateDto {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly packId: string;
  /** The pinned Pack Version; `null` for sessions stored before pinning. */
  readonly packVersion: string | null;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly currentPhase: PhaseIdentifier;
  readonly activeRoundNumber: 1 | 2 | null;
  readonly phaseStartedAt: string;
  /** `null` while the current phase is instructor-driven (no timer). */
  readonly phaseEndsAt: string | null;
  readonly participantCount: number;
  /** The active Gameplay Round's board; `null` outside the rounds. */
  readonly activeBoard: BoardGridViewDto | null;
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
