import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { MongoGameSessionRepository } from "../../src/adapters/outbound/mongo-game-session-repository.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

/** A session as stored before versioning: identical fields, no version. */
interface LegacySessionSeed {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly phaseStartedAt: Date;
}

interface RepositoryHarness {
  readonly repo: GameSessionRepositoryPort;
  /** Stores a session the way it was stored before versioning existed. */
  readonly seedLegacySession: (seed: LegacySessionSeed) => Promise<void>;
}

const LEGACY_TIMER_CONFIG = {
  pretestSec: 900,
  trialOrientationSec: 900,
  roundMappingSec: 1200,
  roundAdjudicationSec: 600,
  posttestSec: 900,
  feedbackSurveySec: 900,
};

function newSession(): GameSession {
  return GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
}

function defineGameSessionRepositoryContract(
  name: string,
  setup: () => Promise<RepositoryHarness>,
  teardown: () => Promise<void> = async () => {},
): void {
  describe(`${name} (game session repository contract)`, () => {
    let harness: RepositoryHarness;

    beforeAll(async () => {
      harness = await setup();
    }, 60_000);

    afterAll(async () => {
      await teardown();
    });

    it("stores a new session at version 0", async () => {
      const session = newSession();

      await harness.repo.create(session);
      const found = await harness.repo.findById(session.sessionId);

      expect(found?.version).toBe(0);
    });

    it("saves a session loaded at the current version and increments the version", async () => {
      const session = newSession();
      await harness.repo.create(session);

      const loaded = await harness.repo.findById(session.sessionId);
      loaded!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      await harness.repo.update(loaded!);

      const reloaded = await harness.repo.findById(session.sessionId);
      expect(reloaded?.version).toBe(1);
      expect(reloaded?.currentPhase).toBe("trial-orientation");

      reloaded!.addParticipant("Alice");
      await harness.repo.update(reloaded!);

      const latest = await harness.repo.findById(session.sessionId);
      expect(latest?.version).toBe(2);
      expect(latest?.participants.map(p => p.displayName)).toEqual(["Alice"]);
    });

    it("rejects a stale save with a conflict and leaves the stored session unchanged", async () => {
      const session = newSession();
      await harness.repo.create(session);
      const first = await harness.repo.findById(session.sessionId);
      const stale = await harness.repo.findById(session.sessionId);

      first!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      await harness.repo.update(first!);
      stale!.addParticipant("Bob");

      await expect(harness.repo.update(stale!)).rejects.toBeInstanceOf(ConcurrentUpdateConflictError);
      const stored = await harness.repo.findById(session.sessionId);
      expect(stored?.version).toBe(1);
      expect(stored?.currentPhase).toBe("trial-orientation");
      expect(stored?.participants).toEqual([]);
    });

    it("loads a session stored without a version as version 0 and saves it once", async () => {
      const seed: LegacySessionSeed = {
        sessionId: `legacy-${name}`,
        roomCode: "LGCY01",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
      };
      await harness.seedLegacySession(seed);

      const loaded = await harness.repo.findById(SessionId.from(seed.sessionId));
      expect(loaded?.version).toBe(0);
      const stale = await harness.repo.findById(SessionId.from(seed.sessionId));

      loaded!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      await harness.repo.update(loaded!);

      const reloaded = await harness.repo.findById(SessionId.from(seed.sessionId));
      expect(reloaded?.version).toBe(1);
      expect(reloaded?.currentPhase).toBe("trial-orientation");
      await expect(harness.repo.update(stale!)).rejects.toBeInstanceOf(ConcurrentUpdateConflictError);
    });

    it("reports a conflict when updating a session that was never stored", async () => {
      const session = newSession();

      await expect(harness.repo.update(session)).rejects.toBeInstanceOf(ConcurrentUpdateConflictError);
      expect(await harness.repo.findById(session.sessionId)).toBeNull();
    });
  });
}

defineGameSessionRepositoryContract("inMemoryGameSessionRepository", async () => {
  const repo = new InMemoryGameSessionRepository();
  return {
    repo,
    seedLegacySession: async (seed) => {
      await repo.create(GameSession.rehydrate({
        sessionId: seed.sessionId,
        roomCode: seed.roomCode,
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: LEGACY_TIMER_CONFIG,
        currentPhase: "pretest",
        phaseStartedAt: seed.phaseStartedAt,
        createdAt: seed.phaseStartedAt,
      }));
    },
  };
});

defineGameSessionRepositoryContract(
  "mongoGameSessionRepository",
  async () => {
    const mongoUri = await startMongoTestServer();
    const mongoDbName = "session-version-contract";
    return {
      repo: MongoGameSessionRepository.fromConfig({ mongoUri, mongoDbName }),
      seedLegacySession: async (seed) => {
        const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
        try {
          await connection.collection(MongoGameSessionRepository.collectionName).insertOne({
            _id: seed.sessionId as unknown as never,
            roomCode: seed.roomCode,
            packId: "diabe-teach",
            mode: "classroom",
            adjudicationMode: "peer-instructor",
            timerConfig: LEGACY_TIMER_CONFIG,
            currentPhase: "pretest",
            phaseStartedAt: seed.phaseStartedAt,
            participants: [],
            activeRoundNumber: null,
            chains: [],
            assessments: [],
            surveyResponse: null,
            createdAt: seed.phaseStartedAt,
          });
        }
        finally {
          await connection.close();
        }
      },
    };
  },
  stopMongoTestServer,
);
