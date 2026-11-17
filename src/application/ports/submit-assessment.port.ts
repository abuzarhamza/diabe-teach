import type { McqAnswerChoice } from "../../domain/game-session/game-session.types.js";
import type { VerifiedCapability } from "./capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./game-session-repository.port.js";

export interface SubmitAssessmentDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
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
 * Metacognitive report computed from pretest/posttest comparison.
 * Matches the OpenAPI LearnerMetacognitiveReport schema.
 */
export interface LearnerMetacognitiveReport {
  readonly participantId: string;
  readonly pretest: AssessmentStageSummary | null;
  readonly posttest: AssessmentStageSummary | null;
  readonly knowledgeGainDelta: number | null;
  readonly guessingReductionDelta: number | null;
  readonly chainDiversityIndex: number;
  readonly neglectedKeywordIds: readonly string[];
}

/**
 * Summary metrics for a single assessment stage.
 * Matches the OpenAPI AssessmentStageSummary schema.
 */
export interface AssessmentStageSummary {
  readonly stage: "pretest" | "posttest";
  readonly totalQuestions: number;
  readonly correctCount: number;
  readonly wrongGuessCount: number;
  readonly iDontKnowCount: number;
  readonly correctPercentage: number;
  readonly wrongGuessPercentage: number;
  readonly iDontKnowPercentage: number;
  readonly uncertaintyCalibrationRatio: number;
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
  execute: (command: SubmitAssessmentCommand) => Promise<SubmitAssessmentResult>;
}
