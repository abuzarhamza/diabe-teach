import type { RoomCode } from "./room-code.js";
import type { SessionId } from "./session-id.js";

export type SessionMode = "solo" | "classroom" | "study-rct";

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
}

export const DEFAULT_TIMER_CONFIG: SessionTimerConfig = {
  pretestSec: 900,
  trialOrientationSec: 900,
  roundMappingSec: 1200,
  roundAdjudicationSec: 600,
  posttestSec: 900,
  feedbackSurveySec: 900,
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
