import type { McqAnswerChoice } from "../../domain/game-session/game-session.types.js";
import type { LearnerMetacognitiveReport } from "../dtos/session-analytics.dto.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type { WriteConflictBackoffPort } from "./write-conflict-backoff.port.js";

export type { AssessmentStageSummary, LearnerMetacognitiveReport } from "../dtos/session-analytics.dto.js";

export interface SubmitAssessmentDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
  /** Waits between write-conflict retries; without one the retrier retries at once. */
  readonly writeConflictBackoff?: WriteConflictBackoffPort;
}

export interface SubmitAssessmentCommand {
  readonly sessionId: string;
  readonly stage: "pretest" | "posttest";
  readonly verifiedCapability: VerifiedCapability;
  readonly answers: Readonly<Record<string, McqAnswerChoice>>;
}

/**
 * Receipt returned for pretest submissions (ungraded to preserve answer-key secrecy)
 */
export interface PretestSubmissionReceipt {
  readonly stage: "pretest";
  readonly participantId: string;
  readonly recordedCount: number;
  readonly submittedAt: string;
}

/**
 * Per-question review item returned in posttest results.
 * Includes both pretest and posttest choices for comparison.
 */
export interface QuestionReviewItem {
  readonly questionId: string;
  readonly stem: string;
  readonly options: readonly [string, string, string, string];
  readonly correctIndex: 0 | 1 | 2 | 3;
  readonly explanation: string | null;
  readonly pretestChoice: McqAnswerChoice | null;
  readonly posttestChoice: McqAnswerChoice;
}

/**
 * Full graded result returned for posttest submissions
 */
export interface PosttestSubmissionResult {
  readonly stage: "posttest";
  readonly participantId: string;
  readonly submittedAt: string;
  readonly report: LearnerMetacognitiveReport;
  readonly answerKeyReview: readonly QuestionReviewItem[];
}

export type SubmitAssessmentResult
  = PretestSubmissionReceipt
    | PosttestSubmissionResult;

export interface SubmitAssessmentUseCasePort {
  execute: (command: SubmitAssessmentCommand, logger?: LoggerPort) => Promise<SubmitAssessmentResult>;
}
