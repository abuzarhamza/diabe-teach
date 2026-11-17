import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoGameSessionRepository } from "../../src/adapters/outbound/mongo-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

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
});
