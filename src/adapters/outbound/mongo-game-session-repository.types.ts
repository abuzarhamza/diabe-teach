import type {
  AdjudicationMode,
  AssessmentStage,
  LikertRating,
  McqAnswerChoice,
  PhaseIdentifier,
  SessionMode,
  SessionTimerConfig,
} from "../../domain/game-session/game-session.types.js";
import type {
  ChainStatus,
  ChainVerdict,
  GridCoord,
  PeerVote,
} from "../../domain/game-session/concept-chain.js";

export interface ParticipantDocument {
  participantId: string;
  displayName: string;
  joinedAt: Date;
}

export interface AssessmentAttemptDocument {
  participantId: string;
  stage: AssessmentStage;
  answers: Record<string, McqAnswerChoice>;
  submittedAt: Date;
}

export interface SurveyResponseDocument {
  participantId: string;
  responses: Record<string, LikertRating>;
  comments?: string;
  submittedAt: Date;
}

export interface ConceptChainDocument {
  chainId: string;
  participantId: string;
  roundNumber: 1 | 2;
  path: GridCoord[];
  keywordIds: string[];
  narrativeExplanation: string;
  stepRationales: string[];
  status: ChainStatus;
  peerVotes: PeerVote[];
  verdict: ChainVerdict | null;
  submittedAt: Date;
}

export interface KeywordCardSnapshotDocument {
  id: string;
  verbatimLabel: string;
  displayLabel: string;
  aliases: string[];
  domainId: string;
  summary: string;
}

/** One Gameplay Round's dealt board; `cells[row][col]` is a card snapshot. */
export interface RoundBoardDocument {
  roundNumber: 1 | 2;
  seed: string;
  rows: number;
  cols: number;
  cells: KeywordCardSnapshotDocument[][];
}

export interface GameSessionDocument {
  _id: string;
  roomCode: string;
  packId: string;
  /** The pinned Pack Version. Absent on sessions stored before pinning (read as null). */
  packVersion?: string | null;
  mode: SessionMode;
  adjudicationMode: AdjudicationMode;
  timerConfig: SessionTimerConfig;
  currentPhase: PhaseIdentifier;
  phaseStartedAt: Date;
  participants: ParticipantDocument[];
  activeRoundNumber: 1 | 2 | null;
  chains: ConceptChainDocument[];
  assessments: AssessmentAttemptDocument[];
  /** Every participant's perception survey response. Absent on sessions stored before per-participant responses. */
  surveyResponses?: SurveyResponseDocument[];
  /** Legacy single survey response, read only when `surveyResponses` is absent. Always written as null. */
  surveyResponse?: SurveyResponseDocument | null;
  createdAt: Date;
  /** Round 1's board seed given at creation. Absent on sessions stored before boards. */
  creationSeed?: string | null;
  /** Each Gameplay Round's dealt board. Absent on sessions stored before boards. */
  roundBoards?: RoundBoardDocument[];
  /** Optimistic-concurrency version. Absent on sessions stored before versioning (read as 0). */
  version?: number;
}

/**
 * Matches a session only while it is still at the expected version. A missing
 * version field is matched by `null`, so legacy sessions match version 0.
 */
export interface GameSessionVersionFilter {
  _id: string;
  version: number | { $in: readonly (number | null)[] };
}

export interface GameSessionCollectionLike {
  findOne: (
    filter: Partial<Pick<GameSessionDocument, "_id" | "roomCode">>,
  ) => Promise<GameSessionDocument | null>;
  find: (
    filter?: Partial<GameSessionDocument>,
  ) => Promise<GameSessionDocument[]>;
  create: (doc: GameSessionDocument) => Promise<void>;
  /** Applies `$set: update` to the matching session and reports how many matched. */
  updateOne: (
    filter: GameSessionVersionFilter,
    update: Partial<Omit<GameSessionDocument, "_id">>,
  ) => Promise<{ matchedCount: number }>;
}

export interface MongoGameSessionRepositoryOptions {
  getCollection: () => Promise<GameSessionCollectionLike>;
}

export interface MongoGameSessionConnectionConfig {
  mongoUri?: string;
  mongoDbName?: string;
}
