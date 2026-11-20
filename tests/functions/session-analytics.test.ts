import type { APIGatewayProxyEvent } from "aws-lambda";
import type { CurriculumPackProps, KeywordCard } from "../../src/domain/curriculum-pack/curriculum-pack.types.js";
import type { AssessmentAttempt, McqAnswerChoice, PhaseIdentifier } from "../../src/domain/game-session/game-session.types.js";
import type { RoundBoard } from "../../src/domain/game-session/round-board.types.js";
import { describe, expect, it } from "vitest";
import { createGetSessionAnalyticsHandler } from "../../netlify/functions/sessions/get-session-analytics.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

const START = new Date("2026-03-01T09:00:00.000Z");
const ALICE = "alice-id";
const BOB = "bob-id";

function card(id: string): KeywordCard {
  const found = DIABE_TEACH_PACK.getCardById(id);
  if (!found) {
    throw new Error(`No card ${id} in the Diabe-teach pack.`);
  }
  return found;
}

/** A hand-dealt 2 × 2 board for a round. */
function board(roundNumber: 1 | 2, ids: readonly [string, string, string, string]): RoundBoard {
  return {
    roundNumber,
    seed: `seed-${roundNumber}`,
    rows: 2,
    cols: 2,
    cells: [
      [
        card(ids[0]),
        card(ids[1]),
      ],
      [
        card(ids[2]),
        card(ids[3]),
      ],
    ],
  };
}

function chain(
  participantId: string,
  roundNumber: 1 | 2,
  keywordIds: readonly string[],
  outcome: "approved-status" | "approved-verdict" | "rejected" | "pending",
): ConceptChain {
  const decidedAt = START;
  return ConceptChain.create({
    participantId,
    roundNumber,
    path: keywordIds.map((_, col) => ({ row: 0, col })),
    keywordIds,
    narrativeExplanation: "Because each card leads to the next one.",
    status: outcome === "approved-status"
      ? "approved"
      : outcome === "rejected"
        ? "rejected"
        : "pending-review",
    verdict: outcome === "approved-verdict"
      ? {
          isApproved: true,
          isLocked: true,
          decidedBy: "instructor",
          decidedAt,
        }
      : outcome === "rejected"
        ? {
            isApproved: false,
            isLocked: true,
            decidedBy: "instructor",
            decidedAt,
          }
        : null,
  });
}

/** The pack's ten questions in order: dm-mcq-01 … dm-mcq-10. */
const QUESTION_IDS = (DIABE_TEACH_PACK.assessmentInstrument?.questions ?? []).map(q => q.id);
const CORRECT = (DIABE_TEACH_PACK.assessmentInstrument?.questions ?? []).map(q => q.correctIndex);

/** `correct` right answers, then `wrong` wrong guesses, then "I don't know" for the rest. */
function attempt(
  participantId: string,
  stage: "pretest" | "posttest",
  correct: number,
  wrong: number,
): AssessmentAttempt {
  const answers = new Map<string, McqAnswerChoice>();
  QUESTION_IDS.forEach((id, i) => {
    const right = CORRECT[i]!;
    if (i < correct) {
      answers.set(id, right);
    }
    else if (i < correct + wrong) {
      answers.set(id, ((right + 1) % 4) as McqAnswerChoice);
    }
    else {
      answers.set(id, "I_DONT_KNOW");
    }
  });
  return {
    participantId,
    stage,
    answers,
    submittedAt: START,
  };
}

/**
 * Hand-computed fixture (Diabe-teach has 7 Semantic Domains, 10 questions):
 * - Round 1 board: adiponectin (anatomy), amylin (anatomy), autoimmune (subtypes), beta-cells (anatomy).
 * - Round 2 board: c-peptide (diagnostics), children (subtypes), diet (therapeutics), adiponectin (anatomy).
 * - Alice's chains: [adiponectin, autoimmune] approved (status); [diet, c-peptide] rejected;
 *   [children, adiponectin] approved (verdict). Approved domains: anatomy, subtypes → 2 / 7.
 *   Used cards: adiponectin, autoimmune, diet, c-peptide, children → neglected: amylin, beta-cells.
 * - Bob's approved chain uses amylin and beta-cells (must not affect Alice).
 * - Alice's Pretest: 3 correct, 5 wrong, 2 IDK → 30 % / 50 %. Posttest: 8, 1, 1 → 80 % / 10 %.
 */
function fixtureSession(options: {
  phase?: PhaseIdentifier;
  withPosttest?: boolean;
  packVersion?: string | null;
} = {}): GameSession {
  const assessments = [
    attempt(ALICE, "pretest", 3, 5),
    attempt(BOB, "pretest", 0, 0),
  ];
  if (options.withPosttest ?? true) {
    assessments.push(attempt(ALICE, "posttest", 8, 1));
  }
  return GameSession.rehydrate({
    packId: "diabe-teach",
    packVersion: options.packVersion === undefined
      ? "1.0.0"
      : options.packVersion,
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    currentPhase: options.phase ?? "feedback-survey",
    phaseStartedAt: START,
    createdAt: START,
    participants: [
      {
        participantId: ALICE,
        displayName: "Alice",
        joinedAt: START,
        leftAt: null,
      },
      {
        participantId: BOB,
        displayName: "Bob",
        joinedAt: START,
        leftAt: null,
      },
    ],
    _roundBoards: [
      board(1, [
        "adiponectin",
        "amylin",
        "autoimmune",
        "beta-cells",
      ]),
      board(2, [
        "c-peptide",
        "children",
        "diet",
        "adiponectin",
      ]),
    ],
    _chains: [
      chain(ALICE, 1, ["adiponectin", "autoimmune"], "approved-status"),
      chain(ALICE, 2, ["diet", "c-peptide"], "rejected"),
      chain(ALICE, 2, ["children", "adiponectin"], "approved-verdict"),
      chain(BOB, 1, ["amylin", "beta-cells"], "approved-status"),
    ],
    _assessments: assessments,
  });
}

function makeEvent(sessionId: string, token?: string): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: `/api/v1/sessions/${sessionId}/analytics`,
    headers: token
      ? { authorization: `Bearer ${token}` }
      : {},
    queryStringParameters: null,
    pathParameters: { sessionId },
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

async function setUp(
  sessions: readonly GameSession[],
  packs: readonly CurriculumPack[] = [DIABE_TEACH_PACK],
) {
  const tokens = new FakeCapabilityTokenAdapter();
  const handler = createGetSessionAnalyticsHandler({
    sessionRepo: new InMemoryGameSessionRepository([...sessions]),
    packRepo: new InMemoryCurriculumPackRepository(packs),
    tokenVerifier: tokens,
  });
  const get = async (sessionId: string, token?: string) => {
    const response = await handler(makeEvent(sessionId, token), {} as never);
    return {
      statusCode: response.statusCode as number,
      body: JSON.parse(response.body),
    };
  };
  const participantToken = (sessionId: string, participantId = ALICE) =>
    tokens.signToken({ role: "participant", sessionId, participantId });
  const instructorToken = (sessionId: string) =>
    tokens.signToken({ role: "instructor", sessionId });
  return { get, participantToken, instructorToken };
}

describe("getSessionAnalytics: GET /api/v1/sessions/{sessionId}/analytics", () => {
  describe("a learner's own report", () => {
    it("returns the participant report and the cohort summary", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const res = await api.get(sessionId, await api.participantToken(sessionId));

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("participant");
      expect(res.body.participantReport.participantId).toBe(ALICE);
      expect(res.body.cohortSummary).toEqual({ sessionId, participantCount: 2 });
    });

    it("summarizes the Pretest and Posttest", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const { participantReport } = (await api.get(sessionId, await api.participantToken(sessionId))).body;

      expect(participantReport.pretest).toEqual({
        stage: "pretest",
        totalQuestions: 10,
        correctCount: 3,
        wrongGuessCount: 5,
        iDontKnowCount: 2,
        correctPercentage: 30,
        wrongGuessPercentage: 50,
        iDontKnowPercentage: 20,
        uncertaintyCalibrationRatio: 2 / 7,
      });
      expect(participantReport.posttest).toEqual({
        stage: "posttest",
        totalQuestions: 10,
        correctCount: 8,
        wrongGuessCount: 1,
        iDontKnowCount: 1,
        correctPercentage: 80,
        wrongGuessPercentage: 10,
        iDontKnowPercentage: 10,
        uncertaintyCalibrationRatio: 0.5,
      });
    });

    it("computes knowledge gain (80 − 30) and guessing reduction (50 − 10)", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const { participantReport } = (await api.get(sessionId, await api.participantToken(sessionId))).body;

      expect(participantReport.knowledgeGainDelta).toBe(50);
      expect(participantReport.guessingReductionDelta).toBe(40);
    });

    it("computes chain diversity from approved chains only (2 of 7 Semantic Domains)", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const { participantReport } = (await api.get(sessionId, await api.participantToken(sessionId))).body;

      expect(participantReport.chainDiversityIndex).toBeCloseTo(2 / 7, 10);
    });

    it("lists the cards on the dealt boards that none of the learner's chains used", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const alice = (await api.get(sessionId, await api.participantToken(sessionId))).body;
      const bob = (await api.get(sessionId, await api.participantToken(sessionId, BOB))).body;

      expect(alice.participantReport.neglectedKeywordIds).toEqual(["amylin", "beta-cells"]);
      expect(bob.participantReport.neglectedKeywordIds).toEqual([
        "adiponectin",
        "autoimmune",
        "c-peptide",
        "children",
        "diet",
      ]);
    });

    it("reads Semantic Domains from the session's pinned Pack Version", async () => {
      const extraDomain = { ...DIABE_TEACH_PACK.domains[0]!, id: "extra-domain", name: "Extra" };
      const version2 = CurriculumPack.create({
        ...(DIABE_TEACH_PACK as unknown as CurriculumPackProps),
        version: "2.0.0",
        domains: [...DIABE_TEACH_PACK.domains, extraDomain],
      });
      const pinned = fixtureSession({ packVersion: "1.0.0" });
      const legacy = fixtureSession({ packVersion: null });
      const api = await setUp([pinned, legacy], [DIABE_TEACH_PACK, version2]);

      const pinnedReport = (await api.get(pinned.sessionId.value, await api.participantToken(pinned.sessionId.value))).body;
      const legacyReport = (await api.get(legacy.sessionId.value, await api.participantToken(legacy.sessionId.value))).body;

      expect(pinnedReport.participantReport.chainDiversityIndex).toBeCloseTo(2 / 7, 10);
      expect(legacyReport.participantReport.chainDiversityIndex).toBeCloseTo(2 / 8, 10);
    });
  });

  describe("missing inputs", () => {
    it("before the posttest, the posttest-based fields are null and the call succeeds", async () => {
      const session = fixtureSession({ phase: "round-2:round-summary", withPosttest: false });
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const res = await api.get(sessionId, await api.participantToken(sessionId));

      expect(res.statusCode).toBe(200);
      expect(res.body.participantReport.pretest.correctPercentage).toBe(30);
      expect(res.body.participantReport.posttest).toBeNull();
      expect(res.body.participantReport.knowledgeGainDelta).toBeNull();
      expect(res.body.participantReport.guessingReductionDelta).toBeNull();
      expect(res.body.participantReport.chainDiversityIndex).toBeCloseTo(2 / 7, 10);
    });

    it("a learner with no attempts, chains or boards gets nulls, 0 and an empty list", async () => {
      const session = GameSession.create({
        packId: "diabe-teach",
        packVersion: "1.0.0",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      });
      const learner = session.addParticipant("Carol");
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const res = await api.get(sessionId, await api.participantToken(sessionId, learner.participantId));

      expect(res.statusCode).toBe(200);
      expect(res.body.participantReport).toEqual({
        participantId: learner.participantId,
        pretest: null,
        posttest: null,
        knowledgeGainDelta: null,
        guessingReductionDelta: null,
        chainDiversityIndex: 0,
        neglectedKeywordIds: [],
      });
      expect(res.body.cohortSummary).toEqual({ sessionId, participantCount: 1 });
    });
  });

  describe("the instructor", () => {
    it("gets the cohort summary without a participant report", async () => {
      const session = fixtureSession();
      const sessionId = session.sessionId.value;
      const api = await setUp([session]);

      const res = await api.get(sessionId, await api.instructorToken(sessionId));

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        role: "instructor",
        cohortSummary: { sessionId, participantCount: 2 },
      });
    });
  });

  describe("errors", () => {
    it("no token → 401", async () => {
      const session = fixtureSession();
      const api = await setUp([session]);

      const res = await api.get(session.sessionId.value);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
    });

    it("another session's token → 403", async () => {
      const session = fixtureSession();
      const other = fixtureSession();
      const api = await setUp([session, other]);

      const res = await api.get(session.sessionId.value, await api.participantToken(other.sessionId.value));

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN_ROLE");
    });

    it("unknown session → 404", async () => {
      const api = await setUp([]);
      const unknownId = "00000000-0000-4000-8000-000000000000";

      const res = await api.get(unknownId, await api.participantToken(unknownId));

      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe("SESSION_NOT_FOUND");
    });
  });
});
