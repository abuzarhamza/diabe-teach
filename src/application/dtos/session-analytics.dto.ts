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
 * One learner's metacognitive report. Matches the OpenAPI
 * LearnerMetacognitiveReport schema. A stage the learner has not taken is
 * `null`, and so is every delta that needs it.
 */
export interface LearnerMetacognitiveReport {
  readonly participantId: string;
  readonly pretest: AssessmentStageSummary | null;
  readonly posttest: AssessmentStageSummary | null;
  /** Posttest % correct − pretest % correct. */
  readonly knowledgeGainDelta: number | null;
  /** Pretest % wrong guesses − posttest % wrong guesses. */
  readonly guessingReductionDelta: number | null;
  /** Distinct Semantic Domains crossed by approved chains ÷ the pack's Semantic Domain count. */
  readonly chainDiversityIndex: number;
  /** Keyword Cards on the dealt round boards that none of the learner's chains used. */
  readonly neglectedKeywordIds: readonly string[];
}

/**
 * The cohort summary (OpenAPI CohortAnalyticsReport). Until api-completion
 * ticket 06 it carries only the session id and the participant count.
 */
export interface CohortAnalyticsReport {
  readonly sessionId: string;
  readonly participantCount: number;
}

/** OpenAPI SessionAnalyticsResponse. */
export type SessionAnalyticsResponse
  = | {
    readonly role: "participant";
    readonly participantReport: LearnerMetacognitiveReport;
    readonly cohortSummary: CohortAnalyticsReport;
  }
  | {
    readonly role: "instructor";
    readonly cohortSummary: CohortAnalyticsReport;
  };
