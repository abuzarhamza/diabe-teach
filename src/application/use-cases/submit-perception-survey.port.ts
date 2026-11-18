import type { LikertRating } from "../../domain/game-session/game-session.types.js";
import type { VerifiedCapability } from "../ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";

export interface SubmitPerceptionSurveyDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
}

export interface SubmitPerceptionSurveyCommand {
  readonly sessionId: string;
  readonly verifiedCapability: VerifiedCapability;
  readonly responses: Readonly<Record<string, LikertRating>>;
  readonly comments?: string;
}

export interface SurveySubmissionReceipt {
  readonly participantId: string;
  readonly recordedItemCount: number;
  readonly submittedAt: string;
}

export interface SubmitPerceptionSurveyUseCasePort {
  execute: (command: SubmitPerceptionSurveyCommand) => Promise<SurveySubmissionReceipt>;
}
