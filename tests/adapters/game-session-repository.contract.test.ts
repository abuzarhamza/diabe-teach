import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import type { LikertRating, McqAnswerChoice } from "../../src/domain/game-session/game-session.types.js";
import type { RoundBoard } from "../../src/domain/game-session/round-board.types.js";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { MongoGameSessionRepository } from "../../src/adapters/outbound/mongo-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

/** A session as stored before versioning: identical fields, no version. */
interface LegacySessionSeed {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly phaseStartedAt: Date;
  /** Learners stored before they could leave: no `leftAt` field. */
  readonly participants?: readonly { participantId: string; displayName: string; joinedAt: Date }[];
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

/** A 2 × 3 board of pack cards, starting at `firstCard` in the pack's card list. */
function boardOf(roundNumber: 1 | 2, seed: string, firstCard: number): RoundBoard {
  const cards = DIABE_TEACH_PACK.cards.slice(firstCard, firstCard + 6);
  return {
    roundNumber,
    seed,
    rows: 2,
    cols: 3,
    cells: [
      cards.slice(0, 3),
      cards.slice(3, 6),
    ],
  };
}

/** An answer set holding a single answer to question "dm-mcq-01". */
function firstAnswer(choice: McqAnswerChoice): ReadonlyMap<string, McqAnswerChoice> {
  return new Map<string, McqAnswerChoice>().set("dm-mcq-01", choice);
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

    it("round-trips every participant's Pretest and Posttest", async () => {
      const session = newSession();
      await harness.repo.create(session);
      const pretestPhase = await harness.repo.findById(session.sessionId);
      const alice = pretestPhase!.addParticipant("Alice");
      const bob = pretestPhase!.addParticipant("Bob");
      pretestPhase!.submitAssessment(alice.participantId, "pretest", firstAnswer("I_DONT_KNOW"));
      pretestPhase!.submitAssessment(bob.participantId, "pretest", firstAnswer(2));
      await harness.repo.update(pretestPhase!);

      const posttestPhase = await harness.repo.findById(session.sessionId);
      for (const phase of [
        "trial-orientation",
        "round-1:chain-mapping",
        "round-1:peer-adjudication",
        "round-1:round-summary",
        "round-2:chain-mapping",
        "round-2:peer-adjudication",
        "round-2:round-summary",
        "posttest",
      ] as const) {
        posttestPhase!.transitionTo(phase, new Date("2026-03-01T10:00:00.000Z"));
      }
      posttestPhase!.submitAssessment(alice.participantId, "posttest", firstAnswer(0));
      posttestPhase!.submitAssessment(bob.participantId, "posttest", firstAnswer(1));
      await harness.repo.update(posttestPhase!);

      const reloaded = await harness.repo.findById(session.sessionId);
      const answersOf = (participantId: string, stage: "pretest" | "posttest") =>
        reloaded!.getAssessment(participantId, stage)?.answers.get("dm-mcq-01");
      expect(answersOf(alice.participantId, "pretest")).toBe("I_DONT_KNOW");
      expect(answersOf(bob.participantId, "pretest")).toBe(2);
      expect(answersOf(alice.participantId, "posttest")).toBe(0);
      expect(answersOf(bob.participantId, "posttest")).toBe(1);
    });

    it("round-trips every participant's perception survey response", async () => {
      const session = newSession();
      await harness.repo.create(session);
      const surveyPhase = await harness.repo.findById(session.sessionId);
      const alice = surveyPhase!.addParticipant("Alice");
      const bob = surveyPhase!.addParticipant("Bob");
      for (const phase of [
        "trial-orientation",
        "round-1:chain-mapping",
        "round-1:peer-adjudication",
        "round-1:round-summary",
        "round-2:chain-mapping",
        "round-2:peer-adjudication",
        "round-2:round-summary",
        "posttest",
        "feedback-survey",
      ] as const) {
        surveyPhase!.transitionTo(phase, new Date("2026-03-01T10:00:00.000Z"));
      }
      surveyPhase!.submitSurvey(alice.participantId, new Map<string, LikertRating>().set("survey-q1", 5), "Loved it");
      surveyPhase!.submitSurvey(bob.participantId, new Map<string, LikertRating>().set("survey-q1", 2));
      await harness.repo.update(surveyPhase!);

      const reloaded = await harness.repo.findById(session.sessionId);
      const aliceResponse = reloaded!.getSurveyResponse(alice.participantId);
      const bobResponse = reloaded!.getSurveyResponse(bob.participantId);
      expect(aliceResponse?.responses.get("survey-q1")).toBe(5);
      expect(aliceResponse?.comments).toBe("Loved it");
      expect(bobResponse?.responses.get("survey-q1")).toBe(2);
      expect(bobResponse?.comments).toBeUndefined();
    });

    it("round-trips the creation seed and each round's board", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        creationSeed: "creation-seed",
      });
      await harness.repo.create(session);
      const round1Board = boardOf(1, "creation-seed", 0);
      const round2Board = boardOf(2, "round-2-seed", 10);

      const inRound1 = await harness.repo.findById(session.sessionId);
      inRound1!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      inRound1!.transitionTo("round-1:chain-mapping", new Date("2026-03-01T09:20:00.000Z"), round1Board);
      await harness.repo.update(inRound1!);

      const afterRound1 = await harness.repo.findById(session.sessionId);
      expect(afterRound1?.creationSeed).toBe("creation-seed");
      expect(afterRound1?.activeBoard).toEqual(round1Board);
      expect(afterRound1?.boardForRound(2)).toBeNull();

      for (const phase of ["round-1:peer-adjudication", "round-1:round-summary"] as const) {
        afterRound1!.transitionTo(phase, new Date("2026-03-01T09:40:00.000Z"));
      }
      afterRound1!.transitionTo("round-2:chain-mapping", new Date("2026-03-01T09:50:00.000Z"), round2Board);
      await harness.repo.update(afterRound1!);

      const reloaded = await harness.repo.findById(session.sessionId);
      expect(reloaded?.creationSeed).toBe("creation-seed");
      expect(reloaded?.boardForRound(1)).toEqual(round1Board);
      expect(reloaded?.boardForRound(2)).toEqual(round2Board);
      expect(reloaded?.activeBoard).toEqual(round2Board);
    });

    it("round-trips the seed of a board dealt from a transition seed", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      });
      await harness.repo.create(session);
      const board = boardOf(1, "transition-seed", 3);

      const loaded = await harness.repo.findById(session.sessionId);
      loaded!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      loaded!.transitionTo("round-1:chain-mapping", new Date("2026-03-01T09:20:00.000Z"), board);
      await harness.repo.update(loaded!);

      const reloaded = await harness.repo.findById(session.sessionId);
      expect(reloaded?.creationSeed).toBeNull();
      expect(reloaded?.boardForRound(1)?.seed).toBe("transition-seed");
      expect(reloaded?.activeBoard).toEqual(board);
    });

    it("round-trips the pinned Pack Version across an update", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        packVersion: "1.2.0",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      });
      await harness.repo.create(session);

      const loaded = await harness.repo.findById(session.sessionId);
      expect(loaded?.packVersion).toBe("1.2.0");
      loaded!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      await harness.repo.update(loaded!);

      expect((await harness.repo.findById(session.sessionId))?.packVersion).toBe("1.2.0");
    });

    it("round-trips the owning Instructor Account across an update", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        ownerAccountId: "account-owner-1",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      });
      await harness.repo.create(session);

      const loaded = await harness.repo.findById(session.sessionId);
      expect(loaded?.ownerAccountId).toBe("account-owner-1");
      loaded!.transitionTo("trial-orientation", new Date("2026-03-01T09:10:00.000Z"));
      await harness.repo.update(loaded!);

      expect((await harness.repo.findById(session.sessionId))?.ownerAccountId).toBe("account-owner-1");
    });

    it("round-trips an extended phase deadline across an update", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
        timerConfig: { pretestSec: 60 },
      });
      await harness.repo.create(session);

      const loaded = await harness.repo.findById(session.sessionId);
      expect(loaded?.extendedPhaseEndsAt).toBeNull();
      loaded!.extendPhase(30, new Date("2026-03-01T09:00:10.000Z"));
      await harness.repo.update(loaded!);

      const reloaded = await harness.repo.findById(session.sessionId);
      expect(reloaded?.phaseEndsAt).toEqual(new Date("2026-03-01T09:01:30.000Z"));
    });

    it("round-trips a learner's leftAt across an update", async () => {
      const session = newSession();
      const alice = session.addParticipant("Alice");
      const bob = session.addParticipant("Bob");
      await harness.repo.create(session);

      const loaded = await harness.repo.findById(session.sessionId);
      expect(loaded?.participants.map(p => p.leftAt)).toEqual([null, null]);
      loaded!.leave(alice.participantId, new Date("2026-03-01T09:05:00.000Z"));
      await harness.repo.update(loaded!);

      const reloaded = await harness.repo.findById(session.sessionId);
      expect(reloaded?.getParticipant(alice.participantId)?.leftAt).toEqual(new Date("2026-03-01T09:05:00.000Z"));
      expect(reloaded?.getParticipant(bob.participantId)?.leftAt).toBeNull();
      expect(reloaded?.participantCount).toBe(1);
    });

    it("loads a participant stored before learners could leave with leftAt null", async () => {
      const joinedAt = new Date("2026-03-01T09:01:00.000Z");
      const seed: LegacySessionSeed = {
        sessionId: `legacy-participant-${name}`,
        roomCode: "LGCY02",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
        participants: [
          { participantId: "legacy-alice", displayName: "Alice", joinedAt },
        ],
      };
      await harness.seedLegacySession(seed);

      const loaded = await harness.repo.findById(SessionId.from(seed.sessionId));

      expect(loaded?.participants).toEqual([
        {
          participantId: "legacy-alice",
          displayName: "Alice",
          joinedAt,
          leftAt: null,
        },
      ]);
      expect(loaded?.participantCount).toBe(1);
    });

    it("stores a solo session with no owner", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        mode: "solo",
        adjudicationMode: "ai",
      });
      await harness.repo.create(session);

      expect((await harness.repo.findById(session.sessionId))?.ownerAccountId).toBeNull();
    });

    it("loads a session stored before Pack Versions were pinned with no pinned version", async () => {
      const seed: LegacySessionSeed = {
        sessionId: `unpinned-${name}`,
        roomCode: "UNPIN1",
        phaseStartedAt: new Date("2026-03-01T09:00:00.000Z"),
      };
      await harness.seedLegacySession(seed);

      const loaded = await harness.repo.findById(SessionId.from(seed.sessionId));

      expect(loaded?.packId).toBe("diabe-teach");
      expect(loaded?.packVersion).toBeNull();
      expect(loaded?.ownerAccountId).toBeNull();
    });

    it("stores a session created without a seed with no creation seed and no boards", async () => {
      const session = newSession();
      await harness.repo.create(session);

      const found = await harness.repo.findById(session.sessionId);

      expect(found?.creationSeed).toBeNull();
      expect(found?.boardForRound(1)).toBeNull();
      expect(found?.activeBoard).toBeNull();
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
        participants: (seed.participants ?? []).map(p => ({ ...p, leftAt: null })),
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
            participants: [
              ...(seed.participants ?? []),
            ],
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
