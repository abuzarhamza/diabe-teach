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

export interface GameSessionDocument {
  _id: string;
  roomCode: string;
  packId: string;
  mode: SessionMode;
  adjudicationMode: AdjudicationMode;
  timerConfig: SessionTimerConfig;
  currentPhase: PhaseIdentifier;
  phaseStartedAt: Date;
  participants: ParticipantDocument[];
  activeRoundNumber: 1 | 2 | null;
  chains: ConceptChainDocument[];
  assessments: AssessmentAttemptDocument[];
  surveyResponse: SurveyResponseDocument | null;
  createdAt: Date;
}

export interface GameSessionCollectionLike {
  findOne: (
    filter: Partial<Pick<GameSessionDocument, "_id" | "roomCode">>,
  ) => Promise<GameSessionDocument | null>;
  find: (
    filter?: Partial<GameSessionDocument>,
  ) => Promise<GameSessionDocument[]>;
  create: (doc: GameSessionDocument) => Promise<void>;
  updateOne: (
    filter: Pick<GameSessionDocument, "_id">,
    update: Partial<Omit<GameSessionDocument, "_id">>,
  ) => Promise<void>;
}

export interface MongoGameSessionRepositoryOptions {
  getCollection: () => Promise<GameSessionCollectionLike>;
}

export interface MongoGameSessionConnectionConfig {
  mongoUri?: string;
  mongoDbName?: string;
}
