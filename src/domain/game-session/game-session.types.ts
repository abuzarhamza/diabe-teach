import type { RoomCode } from "./room-code.js";
import type { RoundBoard } from "./round-board.types.js";
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

/**
 * Phase durations in whole seconds (at least 1). `null` makes the phase
 * instructor-driven: it has no deadline and ends only when the instructor
 * transitions it.
 */
export interface SessionTimerConfig {
  readonly pretestSec: number | null;
  readonly trialOrientationSec: number | null;
  readonly roundMappingSec: number | null;
  readonly roundAdjudicationSec: number | null;
  readonly posttestSec: number | null;
  readonly feedbackSurveySec: number | null;
}

export interface Participant {
  readonly participantId: string;
  readonly displayName: string;
  readonly joinedAt: Date;
}

/**
 * Who is asking to see a Gameplay Round's Concept Chains: the session's
 * instructor, or one participant (by id).
 */
export interface ChainViewer {
  readonly role: "instructor" | "participant";
  readonly participantId?: string;
}

export interface GameSessionProps {
  readonly sessionId?: SessionId | string;
  readonly roomCode?: RoomCode | string;
  readonly packId: string;
  /**
   * The Pack Version the session started with, used for everything it reads
   * from the pack. `null` for sessions stored before pinning, which read the
   * latest version instead.
   */
  readonly packVersion?: string | null;
  /**
   * The Instructor Account that started the session. `null` for solo
   * sessions and for sessions stored before accounts existed.
   */
  readonly ownerAccountId?: string | null;
  readonly mode: SessionMode;
  readonly adjudicationMode: AdjudicationMode;
  readonly timerConfig?: Partial<SessionTimerConfig>;
  readonly currentPhase?: PhaseIdentifier;
  readonly phaseStartedAt?: Date;
  readonly participants?: readonly Participant[];
  readonly activeRoundNumber?: 1 | 2 | null;
  readonly createdAt?: Date;
  /**
   * The seed given at session creation for Round 1's board, or `null` when
   * none was given (sessions stored before boards have none either).
   */
  readonly creationSeed?: string | null;
  /**
   * Stored version for optimistic concurrency. New sessions start at 0;
   * sessions stored before versioning have none and load as 0.
   */
  readonly version?: number;
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _chains?: readonly import("./concept-chain.js").ConceptChain[];
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _assessments?: readonly AssessmentAttempt[];
  /** Used for rehydration from persistence - bypasses phase validation */
  readonly _surveyResponses?: readonly SurveyResponse[];
  /** Each Gameplay Round's dealt board; sessions stored before boards have none. */
  readonly _roundBoards?: readonly RoundBoard[];
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

/** The fields of SessionTimerConfig, in declaration order. */
export const TIMER_FIELDS: readonly (keyof SessionTimerConfig)[] = [
  "pretestSec",
  "trialOrientationSec",
  "roundMappingSec",
  "roundAdjudicationSec",
  "posttestSec",
  "feedbackSurveySec",
];

/**
 * Longest allowed phase duration (24 hours). Keeps `phaseEndsAt` a valid
 * date; a phase that should run longer can be untimed (`null`).
 */
export const MAX_TIMER_DURATION_SEC = 86_400;

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

/**
 * The Gameplay Round each phase belongs to, or `null` outside the rounds.
 * Typed as a full Record so adding a phase forces a decision here.
 */
export const PHASE_GAMEPLAY_ROUND: Readonly<Record<PhaseIdentifier, 1 | 2 | null>> = {
  "pretest": null,
  "trial-orientation": null,
  "round-1:chain-mapping": 1,
  "round-1:peer-adjudication": 1,
  "round-1:round-summary": 1,
  "round-2:chain-mapping": 2,
  "round-2:peer-adjudication": 2,
  "round-2:round-summary": 2,
  "posttest": null,
  "feedback-survey": null,
  "completed": null,
};

/** Every phase, in the order a Game Session moves through them. */
export const PHASE_ORDER: readonly PhaseIdentifier[] = [
  "pretest",
  "trial-orientation",
  "round-1:chain-mapping",
  "round-1:peer-adjudication",
  "round-1:round-summary",
  "round-2:chain-mapping",
  "round-2:peer-adjudication",
  "round-2:round-summary",
  "posttest",
  "feedback-survey",
  "completed",
];

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
