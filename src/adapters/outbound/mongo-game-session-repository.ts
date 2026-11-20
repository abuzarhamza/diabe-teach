import type { Connection, Model } from "mongoose";
import type { GameSessionRepositoryPort } from "../../application/ports/game-session-repository.port.js";
import type { AssessmentAttempt, LikertRating, McqAnswerChoice, SurveyResponse } from "../../domain/game-session/game-session.types.js";
import type { RoomCode } from "../../domain/game-session/room-code.js";
import type { RoundBoard } from "../../domain/game-session/round-board.types.js";
import type { SessionId } from "../../domain/game-session/session-id.js";
import type {
  AssessmentAttemptDocument,
  ConceptChainDocument,
  GameSessionCollectionLike,
  GameSessionDocument,
  MongoGameSessionConnectionConfig,
  MongoGameSessionRepositoryOptions,
  ParticipantDocument,
  RoundBoardDocument,
  SurveyResponseDocument,
} from "./mongo-game-session-repository.types.js";
import { ConcurrentUpdateConflictError } from "../../domain/errors/domain-errors.js";
import { ConceptChain } from "../../domain/game-session/concept-chain.js";
import { GameSession } from "../../domain/game-session/game-session.js";
import { DEFAULT_MONGODB_DB_NAME } from "./curriculum-pack.schema.js";
import {
  GAME_SESSION_MODEL_NAME,
  GAME_SESSIONS_COLLECTION,
  gameSessionSchema,
} from "./game-session.schema.js";
import { MongoConnectionManager } from "./mongo-client-singleton.js";

export {
  GAME_SESSION_MODEL_NAME,
  GAME_SESSIONS_COLLECTION,
  gameSessionSchema,
};

export class MongoGameSessionRepository implements GameSessionRepositoryPort {
  public static readonly modelName = GAME_SESSION_MODEL_NAME;
  public static readonly collectionName = GAME_SESSIONS_COLLECTION;

  readonly #getCollection: () => Promise<GameSessionCollectionLike>;

  public constructor(options: MongoGameSessionRepositoryOptions) {
    this.#getCollection = options.getCollection;
  }

  public static getModel(connection: Connection): Model<GameSessionDocument> {
    return (
      (connection.models[GAME_SESSION_MODEL_NAME] as
      | Model<GameSessionDocument>
      | undefined)
    ?? connection.model<GameSessionDocument>(
      GAME_SESSION_MODEL_NAME,
      gameSessionSchema,
      GAME_SESSIONS_COLLECTION,
    )
    );
  }

  public static fromConfig(
    config: MongoGameSessionConnectionConfig,
  ): MongoGameSessionRepository {
    return new MongoGameSessionRepository({
      getCollection: async () => {
        if (!config.mongoUri) {
          throw new Error(
            "MONGODB_URI environment variable is required for game sessions.",
          );
        }
        const connection = await MongoConnectionManager.getConnection(
          config.mongoUri,
          config.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
        );
        const model = MongoGameSessionRepository.getModel(connection);
        return {
          findOne: async filter =>
            model.findOne(filter).lean<GameSessionDocument | null>().exec(),
          find: async (filter = {}) =>
            model.find(filter).lean<GameSessionDocument[]>().exec(),
          create: async (doc) => {
            await model.create(doc);
          },
          updateOne: async (filter, update) => {
            const result = await model.updateOne(filter, { $set: update }).exec();
            return { matchedCount: result.matchedCount };
          },
        };
      },
    });
  }

  public async create(session: GameSession): Promise<void> {
    const collection = await this.#getCollection();
    const doc = MongoGameSessionRepository.#toDocument(session);
    await collection.create({ ...doc, version: 0 });
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ _id: sessionId.value });
    return doc
      ? MongoGameSessionRepository.#toDomain(doc)
      : null;
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ roomCode: roomCode.value });
    return doc
      ? MongoGameSessionRepository.#toDomain(doc)
      : null;
  }

  /**
   * Saves the session only if the stored copy is still at the version it was
   * loaded at, storing version + 1 in the same operation. Throws
   * ConcurrentUpdateConflictError if another write got there first or the
   * session is not stored.
   */
  public async update(session: GameSession): Promise<void> {
    const collection = await this.#getCollection();
    const doc = MongoGameSessionRepository.#toDocument(session);
    const { _id, ...updateFields } = doc;
    const expectedVersion = session.version;
    // `null` also matches a missing field: legacy sessions are at version 0.
    const versionFilter = expectedVersion === 0
      ? {
          $in: [0, null],
        }
      : expectedVersion;
    const { matchedCount } = await collection.updateOne(
      { _id, version: versionFilter },
      { ...updateFields, version: expectedVersion + 1 },
    );
    if (matchedCount === 0) {
      throw new ConcurrentUpdateConflictError(_id, expectedVersion);
    }
  }

  static #toDomain(doc: GameSessionDocument): GameSession {
    // Restore chains for rehydration
    const chains = doc.chains.map(chainDoc =>
      ConceptChain.create({
        chainId: chainDoc.chainId,
        participantId: chainDoc.participantId,
        roundNumber: chainDoc.roundNumber,
        path: chainDoc.path,
        keywordIds: chainDoc.keywordIds,
        narrativeExplanation: chainDoc.narrativeExplanation,
        stepRationales: chainDoc.stepRationales,
        status: chainDoc.status,
        peerVotes: chainDoc.peerVotes,
        verdict: chainDoc.verdict,
        submittedAt: chainDoc.submittedAt,
      }),
    );

    // Restore assessments for rehydration
    const assessments: AssessmentAttempt[] = (doc.assessments ?? []).map(
      (attemptDoc): AssessmentAttempt => ({
        participantId: attemptDoc.participantId,
        stage: attemptDoc.stage,
        answers: new Map(Object.entries(attemptDoc.answers)) as ReadonlyMap<string, McqAnswerChoice>,
        submittedAt: attemptDoc.submittedAt,
      }),
    );

    // Restore survey responses for rehydration. A document stored before
    // per-participant responses holds a single `surveyResponse` and no list.
    const legacySurveyResponseDocs = doc.surveyResponse
      ? [doc.surveyResponse]
      : [];
    const surveyResponseDocs = doc.surveyResponses ?? legacySurveyResponseDocs;
    const surveyResponses: SurveyResponse[] = surveyResponseDocs.map(
      (responseDoc): SurveyResponse => ({
        participantId: responseDoc.participantId,
        responses: new Map(Object.entries(responseDoc.responses)) as ReadonlyMap<string, LikertRating>,
        ...(responseDoc.comments !== undefined && { comments: responseDoc.comments }),
        submittedAt: responseDoc.submittedAt,
      }),
    );

    return GameSession.rehydrate({
      sessionId: doc._id,
      roomCode: doc.roomCode,
      packId: doc.packId,
      packVersion: doc.packVersion ?? null,
      ownerAccountId: doc.ownerAccountId ?? null,
      mode: doc.mode,
      adjudicationMode: doc.adjudicationMode,
      timerConfig: doc.timerConfig,
      currentPhase: doc.currentPhase,
      phaseStartedAt: doc.phaseStartedAt,
      extendedPhaseEndsAt: doc.extendedPhaseEndsAt ?? null,
      participants: doc.participants.map((p: ParticipantDocument) => ({
        participantId: p.participantId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt ?? null,
      })),
      activeRoundNumber: doc.activeRoundNumber,
      createdAt: doc.createdAt,
      creationSeed: doc.creationSeed ?? null,
      version: doc.version ?? 0,
      _chains: chains,
      _assessments: assessments,
      _surveyResponses: surveyResponses,
      _roundBoards: (doc.roundBoards ?? []).map(MongoGameSessionRepository.#copyRoundBoard),
    });
  }

  /** Copies a round board card by card; serves both loading and saving. */
  static #copyRoundBoard(board: RoundBoard): RoundBoardDocument {
    return {
      roundNumber: board.roundNumber,
      seed: board.seed,
      rows: board.rows,
      cols: board.cols,
      cells: board.cells.map(row => row.map(card => ({
        id: card.id,
        verbatimLabel: card.verbatimLabel,
        displayLabel: card.displayLabel,
        aliases: [...card.aliases],
        domainId: card.domainId,
        summary: card.summary,
      }))),
    };
  }

  static #toDocument(session: GameSession): GameSessionDocument {
    return {
      _id: session.sessionId.value,
      roomCode: session.roomCode.value,
      packId: session.packId,
      packVersion: session.packVersion,
      ownerAccountId: session.ownerAccountId,
      mode: session.mode,
      adjudicationMode: session.adjudicationMode,
      timerConfig: session.timerConfig,
      currentPhase: session.currentPhase,
      phaseStartedAt: session.phaseStartedAt,
      extendedPhaseEndsAt: session.extendedPhaseEndsAt,
      participants: session.participants.map(p => ({
        participantId: p.participantId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
      activeRoundNumber: session.activeRoundNumber,
      chains: session.chains.map(c =>
        MongoGameSessionRepository.#chainToDocument(c),
      ),
      assessments: MongoGameSessionRepository.#assessmentsToDocument(session.assessmentAttempts),
      surveyResponses: session.surveyResponses.map(response =>
        MongoGameSessionRepository.#surveyResponseToDocument(response),
      ),
      // Clears the legacy single-response field so it cannot diverge from the list.
      surveyResponse: null,
      createdAt: session.createdAt,
      creationSeed: session.creationSeed,
      roundBoards: session.roundBoards.map(MongoGameSessionRepository.#copyRoundBoard),
    };
  }

  static #surveyResponseToDocument(
    surveyResponse: SurveyResponse,
  ): SurveyResponseDocument {
    return {
      participantId: surveyResponse.participantId,
      responses: Object.fromEntries(surveyResponse.responses) as Record<string, LikertRating>,
      ...(surveyResponse.comments !== undefined && { comments: surveyResponse.comments }),
      submittedAt: surveyResponse.submittedAt,
    };
  }

  static #assessmentsToDocument(
    assessments: readonly AssessmentAttempt[],
  ): AssessmentAttemptDocument[] {
    return assessments.map(attempt => ({
      participantId: attempt.participantId,
      stage: attempt.stage,
      answers: Object.fromEntries(attempt.answers) as Record<string, McqAnswerChoice>,
      submittedAt: attempt.submittedAt,
    }));
  }

  static #chainToDocument(chain: ConceptChain): ConceptChainDocument {
    return {
      chainId: chain.chainId,
      participantId: chain.participantId,
      roundNumber: chain.roundNumber,
      path: [...chain.path],
      keywordIds: [...chain.keywordIds],
      narrativeExplanation: chain.narrativeExplanation,
      stepRationales: [...chain.stepRationales],
      status: chain.status,
      peerVotes: [...chain.peerVotes],
      verdict: chain.verdict,
      submittedAt: chain.submittedAt,
    };
  }
}
