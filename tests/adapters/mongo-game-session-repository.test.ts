import type { LikertRating } from "../../src/domain/game-session/game-session.types.js";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gameSessionSchema } from "../../src/adapters/outbound/game-session.schema.js";
import { MongoCurriculumPackRepository } from "../../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { MongoGameSessionRepository } from "../../src/adapters/outbound/mongo-game-session-repository.js";
import { SessionPackLoader } from "../../src/application/services/session-pack-loader.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { PHASE_ORDER } from "../../src/domain/game-session/game-session.types.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

describe("game session schema", () => {
  it("allows exactly the domain's phases, in PHASE_ORDER", () => {
    const currentPhase = gameSessionSchema.path("currentPhase") as unknown as { enumValues: readonly string[] };

    expect(currentPhase.enumValues).toEqual(PHASE_ORDER);
  });
});

describe("mongoGameSessionRepository timer config persistence", () => {
  const mongoDbName = "timer-config-round-trip";
  let mongoUri: string;
  let repo: MongoGameSessionRepository;

  beforeAll(async () => {
    mongoUri = await startMongoTestServer();
    repo = MongoGameSessionRepository.fromConfig({ mongoUri, mongoDbName });
  }, 60_000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  it("round-trips null timer fields so instructor-driven phases stay untimed", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig: { roundMappingSec: null, roundAdjudicationSec: null },
    });

    await repo.create(session);
    const found = await repo.findById(session.sessionId);

    expect(found?.timerConfig).toEqual({
      pretestSec: 900,
      trialOrientationSec: 900,
      roundMappingSec: null,
      roundAdjudicationSec: null,
      posttestSec: 900,
      feedbackSurveySec: 900,
    });
  });

  it("keeps null timer fields across an update", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig: { roundMappingSec: null },
      phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
    });
    await repo.create(session);

    session.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
    session.transitionTo("round-1:chain-mapping", new Date("2026-03-01T09:20:00.000Z"));
    await repo.update(session);
    const found = await repo.findById(session.sessionId);

    expect(found?.currentPhase).toBe("round-1:chain-mapping");
    expect(found?.timerConfig.roundMappingSec).toBeNull();
    expect(found?.phaseEndsAt).toBeNull();
  });

  it("still round-trips fully numeric timer configs", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig: { pretestSec: 60, roundMappingSec: 300 },
    });

    await repo.create(session);
    const found = await repo.findById(session.sessionId);

    expect(found?.timerConfig).toEqual({
      pretestSec: 60,
      trialOrientationSec: 900,
      roundMappingSec: 300,
      roundAdjudicationSec: 600,
      posttestSec: 900,
      feedbackSurveySec: 900,
    });
  });

  it("loads a legacy single survey response as that participant's response and saves it in the list form", async () => {
    const submittedAt = new Date("2026-03-01T11:00:00.000Z");
    const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
    const collection = connection.collection(MongoGameSessionRepository.collectionName);
    try {
      await collection.insertOne({
        _id: "legacy-single-survey" as unknown as never,
        roomCode: "LGSRVY",
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: {
          pretestSec: 900,
          trialOrientationSec: 900,
          roundMappingSec: 1200,
          roundAdjudicationSec: 600,
          posttestSec: 900,
          feedbackSurveySec: 900,
        },
        currentPhase: "feedback-survey",
        phaseStartedAt: new Date("2026-03-01T10:00:00.000Z"),
        participants: [
          {
            participantId: "p-alice",
            displayName: "Alice",
            joinedAt: new Date("2026-03-01T09:00:00.000Z"),
          },
          {
            participantId: "p-bob",
            displayName: "Bob",
            joinedAt: new Date("2026-03-01T09:00:00.000Z"),
          },
        ],
        activeRoundNumber: null,
        chains: [],
        assessments: [],
        surveyResponse: {
          participantId: "p-alice",
          responses: { "survey-q1": 4 },
          comments: "Stored before per-participant surveys",
          submittedAt,
        },
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
      });

      const loaded = await repo.findById(SessionId.from("legacy-single-survey"));
      const aliceResponse = loaded?.getSurveyResponse("p-alice");
      expect(aliceResponse?.responses.get("survey-q1")).toBe(4);
      expect(aliceResponse?.comments).toBe("Stored before per-participant surveys");
      expect(aliceResponse?.submittedAt).toEqual(submittedAt);

      loaded!.submitSurvey("p-bob", new Map<string, LikertRating>().set("survey-q1", 2));
      await repo.update(loaded!);

      const stored = await collection.findOne({ _id: "legacy-single-survey" as unknown as never });
      expect(stored?.surveyResponse).toBeNull();
      expect(stored?.surveyResponses).toEqual([
        {
          participantId: "p-alice",
          responses: { "survey-q1": 4 },
          comments: "Stored before per-participant surveys",
          submittedAt,
        },
        expect.objectContaining({
          participantId: "p-bob",
          responses: { "survey-q1": 2 },
        }),
      ]);
      const reloaded = await repo.findById(SessionId.from("legacy-single-survey"));
      expect(reloaded?.getSurveyResponse("p-alice")?.responses.get("survey-q1")).toBe(4);
      expect(reloaded?.getSurveyResponse("p-bob")?.responses.get("survey-q1")).toBe(2);
    }
    finally {
      await connection.close();
    }
  });

  it("still loads a session stored before create-time timer validation (legacy zero duration)", async () => {
    const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
    try {
      await connection.collection(MongoGameSessionRepository.collectionName).insertOne({
        _id: "legacy-zero-timer" as unknown as never,
        roomCode: "LEGACY",
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: {
          pretestSec: 900,
          trialOrientationSec: 900,
          roundMappingSec: 0,
          roundAdjudicationSec: 600,
          posttestSec: 900,
          feedbackSurveySec: 900,
        },
        currentPhase: "pretest",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
        participants: [],
        activeRoundNumber: null,
        chains: [],
        assessments: [],
        surveyResponse: null,
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
      });
    }
    finally {
      await connection.close();
    }

    const found = await repo.findById(SessionId.from("legacy-zero-timer"));

    expect(found?.timerConfig.roundMappingSec).toBe(0);
  });

  it("loads a session stored before server-dealt boards with no board and no creation seed", async () => {
    const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
    try {
      await connection.collection(MongoGameSessionRepository.collectionName).insertOne({
        _id: "legacy-no-board" as unknown as never,
        roomCode: "LGBORD",
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: {
          pretestSec: 900,
          trialOrientationSec: 900,
          roundMappingSec: 1200,
          roundAdjudicationSec: 600,
          posttestSec: 900,
          feedbackSurveySec: 900,
        },
        currentPhase: "round-1:chain-mapping",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
        participants: [],
        activeRoundNumber: 1,
        chains: [],
        assessments: [],
        surveyResponses: [],
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
        version: 3,
      });
    }
    finally {
      await connection.close();
    }

    const found = await repo.findById(SessionId.from("legacy-no-board"));

    expect(found?.currentPhase).toBe("round-1:chain-mapping");
    expect(found?.activeBoard).toBeNull();
    expect(found?.boardForRound(1)).toBeNull();
    expect(found?.creationSeed).toBeNull();

    found!.transitionTo("round-1:peer-adjudication", new Date("2026-03-01T09:20:00.000Z"));
    await repo.update(found!);
    const reloaded = await repo.findById(SessionId.from("legacy-no-board"));
    expect(reloaded?.currentPhase).toBe("round-1:peer-adjudication");
    expect(reloaded?.activeBoard).toBeNull();
  });

  it("loads a session stored before Pack Versions were pinned and accounts existed: no owner, and the pack's latest version", async () => {
    const packRepo = MongoCurriculumPackRepository.fromConfig({ mongoUri, mongoDbName });
    for (const version of ["1.0.0", "2.0.0"]) {
      await packRepo.create(CurriculumPack.create({
        id: "unpinned-pack",
        title: `Unpinned ${version}`,
        version,
        description: DIABE_TEACH_PACK.description,
        boardConfig: DIABE_TEACH_PACK.boardConfig,
        domains: DIABE_TEACH_PACK.domains,
        cards: DIABE_TEACH_PACK.cards,
        adjudicationRubric: DIABE_TEACH_PACK.adjudicationRubric,
        assessmentInstrument: DIABE_TEACH_PACK.assessmentInstrument,
        perceptionSurvey: DIABE_TEACH_PACK.perceptionSurvey,
        isSystemPack: false,
        isArchived: false,
        createdBy: null,
        authorName: null,
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        archivedAt: null,
      }));
    }
    const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
    try {
      await connection.collection(MongoGameSessionRepository.collectionName).insertOne({
        _id: "legacy-unpinned" as unknown as never,
        roomCode: "LGPIN1",
        packId: "unpinned-pack",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: {
          pretestSec: 900,
          trialOrientationSec: 900,
          roundMappingSec: 1200,
          roundAdjudicationSec: 600,
          posttestSec: 900,
          feedbackSurveySec: 900,
        },
        currentPhase: "pretest",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
        participants: [],
        activeRoundNumber: null,
        chains: [],
        assessments: [],
        surveyResponses: [],
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
        version: 0,
      });
    }
    finally {
      await connection.close();
    }

    const found = await repo.findById(SessionId.from("legacy-unpinned"));

    expect(found?.packVersion).toBeNull();
    expect(found?.ownerAccountId).toBeNull();
    expect((await new SessionPackLoader(packRepo).load(found!)).version).toBe("2.0.0");

    found!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
    await repo.update(found!);
    const reloaded = await repo.findById(SessionId.from("legacy-unpinned"));
    expect(reloaded?.packVersion).toBeNull();
    expect(reloaded?.ownerAccountId).toBeNull();
  });
});
