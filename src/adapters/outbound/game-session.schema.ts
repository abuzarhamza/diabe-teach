import { Schema } from "mongoose";

export const GAME_SESSION_MODEL_NAME = "GameSession";
export const GAME_SESSIONS_COLLECTION = "game_sessions";

const gridCoordSchema = new Schema(
  {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  { _id: false },
);

const peerVoteSchema = new Schema(
  {
    voterParticipantId: { type: String, required: true },
    decision: { type: String, enum: ["approve", "challenge"], required: true },
    comment: { type: String },
    votedAt: { type: Date, required: true },
  },
  { _id: false },
);

const chainVerdictSchema = new Schema(
  {
    isApproved: { type: Boolean, required: true },
    isLocked: { type: Boolean, required: true },
    feedback: { type: String },
    qualityScore: { type: Number },
    decidedBy: {
      type: String,
      enum: ["peer-consensus", "ai", "instructor"],
      required: true,
    },
    decidedAt: { type: Date, required: true },
  },
  { _id: false },
);

const conceptChainSchema = new Schema(
  {
    chainId: { type: String, required: true },
    participantId: { type: String, required: true },
    roundNumber: { type: Number, enum: [1, 2], required: true },
    path: { type: [gridCoordSchema], required: true },
    keywordIds: { type: [String], required: true },
    narrativeExplanation: { type: String, required: true },
    stepRationales: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending-review", "approved", "rejected"],
      default: "pending-review",
    },
    peerVotes: { type: [peerVoteSchema], default: [] },
    verdict: { type: chainVerdictSchema, default: null },
    submittedAt: { type: Date, required: true },
  },
  { _id: false },
);

const participantSchema = new Schema(
  {
    participantId: { type: String, required: true },
    displayName: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { _id: false },
);

// Not `required`: Mongoose's required validator rejects `null`, which marks an
// instructor-driven (untimed) phase. The domain always writes every field.
const timerConfigSchema = new Schema(
  {
    pretestSec: { type: Number },
    trialOrientationSec: { type: Number },
    roundMappingSec: { type: Number },
    roundAdjudicationSec: { type: Number },
    posttestSec: { type: Number },
    feedbackSurveySec: { type: Number },
  },
  { _id: false },
);

const assessmentAttemptSchema = new Schema(
  {
    participantId: { type: String, required: true },
    stage: { type: String, enum: ["pretest", "posttest"], required: true },
    answers: { type: Schema.Types.Mixed, required: true },
    submittedAt: { type: Date, required: true },
  },
  { _id: false },
);

const surveyResponseSchema = new Schema(
  {
    participantId: { type: String, required: true },
    responses: { type: Schema.Types.Mixed, required: true },
    comments: { type: String },
    submittedAt: { type: Date, required: true },
  },
  { _id: false },
);

export const gameSessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    roomCode: { type: String, required: true, unique: true, index: true },
    packId: { type: String, required: true },
    mode: {
      type: String,
      enum: ["solo", "classroom", "study-rct"],
      required: true,
    },
    adjudicationMode: {
      type: String,
      enum: ["ai", "peer-instructor", "hybrid"],
      required: true,
    },
    timerConfig: { type: timerConfigSchema, required: true },
    currentPhase: {
      type: String,
      enum: [
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
      ],
      default: "pretest",
    },
    phaseStartedAt: { type: Date, required: true },
    participants: { type: [participantSchema], default: [] },
    activeRoundNumber: { type: Number, enum: [1, 2, null], default: null },
    chains: { type: [conceptChainSchema], default: [] },
    assessments: { type: [assessmentAttemptSchema], default: [] },
    surveyResponse: { type: surveyResponseSchema, default: null },
    createdAt: { type: Date, required: true },
    // Optimistic-concurrency version. Sessions stored before it existed have
    // no value and are read as 0.
    version: { type: Number },
  },
  {
    collection: GAME_SESSIONS_COLLECTION,
    timestamps: false,
  },
);
