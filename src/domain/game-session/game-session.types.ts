import type { RoomCode } from "./room-code.js";
import type { SessionId } from "./session-id.js";

export type SessionMode = "solo" | "classroom" | "study-rct";

export type McqAnswerChoice = 0 | 1 | 2 | 3 | "I_DONT_KNOW";

export type AssessmentStage = "pretest" | "posttest";

export interface AssessmentAttempt {
  readonly participantId: string;
  readonly stage: AssessmentStage;
  readonly answers: ReadonlyMap<string, McqAnswerChoice>;
  readonly submittedAt: Date;
}

export type LikertRating = 1 | 2 | 3 | 4 | 5;

export interface SurveyResponse {
  readonly participantId: string;
  readonly responses: ReadonlyMap<string, LikertRating>;
  readonly comments?: string;
  readonly submittedAt: Date;
}

export type AdjudicationMode = "ai" | "peer-instructor" | "hybrid";

export type PhaseIdentifier
  = | "pretest"
    | "trial-orientation"
    | "round-1:chain-mapping"
    | "round-1:peer-adjudication"
    | "round-1:round-summary"
    | "round-2:chain-mapping"
    | "round-2:peer-adjudication"
    | "round-2:round-summary"
    | "posttest"
    | "feedback-survey"
    | "completed";

export interface SessionTimerConfig {
  readonly pretestSec: number;
  readonly trialOrientationSec: number;
  readonly roundMappingSec: number;
  readonly roundAdjudicationSec: number;
  readonly posttestSec: number;
  readonly feedbackSurveySec: number;
}

export interface Participant {
  readonly participantId: string;
  readonly displayName: string;
  readonly joinedAt: Date;
}

export interface GameSessionProps {
  readonly sessionId?: SessionId | string;
  readonly roomCode?: RoomCode | string;
  readonly packId: string;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly timerConfig?: Partial<SessionTimerConfig>;
  readonly currentPhase?: PhaseIdentifier;
  readonly phaseStartedAt?: Date;
  readonly participants?: readonly Participant[];
  readonly activeRoundNumber?: 1 | 2 | null;
  readonly createdAt?: Date;
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _chains?: readonly import("./concept-chain.js").ConceptChain[];
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _assessments?: ReadonlyMap<AssessmentStage, AssessmentAttempt>;
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _surveyResponse?: SurveyResponse;
}

/**
 * How long after `phaseEndsAt` a Chain-Mapping phase still accepts
 * Concept Chains, to absorb network delay on last-second submissions.
 */
export const SUBMISSION_GRACE_PERIOD_SEC = 5;

export const DEFAULT_TIMER_CONFIG: SessionTimerConfig = {
  pretestSec: 900,
  trialOrientationSec: 900,
  roundMappingSec: 1200,
  roundAdjudicationSec: 600,
  posttestSec: 900,
  feedbackSurveySec: 900,
};

/**
 * Which timer-config field sets each phase's duration. `null` means the phase
 * has no configured duration (it ends the moment it starts). Typed as a full
 * Record so adding a phase forces a decision here.
 */
export const PHASE_TIMER_FIELD: Readonly<Record<PhaseIdentifier, keyof SessionTimerConfig | null>> = {
  "pretest": "pretestSec",
  "trial-orientation": "trialOrientationSec",
  "round-1:chain-mapping": "roundMappingSec",
  "round-1:peer-adjudication": "roundAdjudicationSec",
  "round-1:round-summary": null,
  "round-2:chain-mapping": "roundMappingSec",
  "round-2:peer-adjudication": "roundAdjudicationSec",
  "round-2:round-summary": null,
  "posttest": "posttestSec",
  "feedback-survey": "feedbackSurveySec",
  "completed": null,
};

export const PHASE_TRANSITIONS: ReadonlyMap<PhaseIdentifier, PhaseIdentifier> = new Map([
  ["pretest", "trial-orientation"],
  ["trial-orientation", "round-1:chain-mapping"],
  ["round-1:chain-mapping", "round-1:peer-adjudication"],
  ["round-1:peer-adjudication", "round-1:round-summary"],
  ["round-1:round-summary", "round-2:chain-mapping"],
  ["round-2:chain-mapping", "round-2:peer-adjudication"],
  ["round-2:peer-adjudication", "round-2:round-summary"],
  ["round-2:round-summary", "posttest"],
  ["posttest", "feedback-survey"],
  ["feedback-survey", "completed"],
]);
