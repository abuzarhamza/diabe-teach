import type { APIGatewayProxyEvent } from "aws-lambda";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createListRoundChainsHandler } from "../../netlify/functions/sessions/list-round-chains.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { CAPABILITY_TOKEN_KIND } from "../../src/adapters/outbound/token-kinds.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { TEST_TEACHER } from "./support/signed-in-teacher.js";

// Both token kinds share one secret on purpose: only the `kind` claim keeps
// an Account Token from passing as a Capability Token.
const SECRET = "test-list-round-chains-secret";

function makeEvent(
  sessionId: string,
  roundNumber: number | string,
  token?: string,
): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains`,
    headers: token
      ? { authorization: `Bearer ${token}` }
      : {},
    queryStringParameters: null,
    pathParameters: {
      sessionId,
      roundNumber: String(roundNumber),
    },
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

function pathOnRow(row: number, length: number) {
  return Array.from({ length }, (_, col) => ({ row, col }));
}

/**
 * A classroom session in Round 1 chain-mapping with three chains, added out
 * of submission order: Bob's (10:02), Alice's first (10:01, with a peer vote
 * and a locked Instructor Final Ruling) and Alice's second (10:03).
 */
function makeWorld(
  addMoreChains?: (session: GameSession, carolId: string) => void,
  playOn?: (session: GameSession, people: { aliceId: string; bobId: string; carolId: string }) => void,
) {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  session.transitionTo("trial-orientation", new Date());
  session.transitionTo("round-1:chain-mapping", new Date());
  const alice = session.addParticipant("Alice");
  const bob = session.addParticipant("Bob");
  const carol = session.addParticipant("Carol");

  const bobChain = ConceptChain.create({
    participantId: bob.participantId,
    roundNumber: 1,
    path: pathOnRow(1, 4),
    keywordIds: ["kw-6", "kw-7", "kw-8", "kw-9"],
    narrativeExplanation: "Bob's chain",
    submittedAt: new Date("2026-11-19T10:02:00.000Z"),
  });
  const aliceFirst = ConceptChain.create({
    participantId: alice.participantId,
    roundNumber: 1,
    path: pathOnRow(0, 5),
    keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4", "kw-5"],
    narrativeExplanation: "Alice's first chain",
    stepRationales: ["a", "b", "c", "d"],
    submittedAt: new Date("2026-11-19T10:01:00.000Z"),
  });
  aliceFirst.addPeerVote({
    voterParticipantId: bob.participantId,
    decision: "approve",
    comment: "Holds up",
  });
  aliceFirst.setVerdict({
    isApproved: true,
    isLocked: true,
    feedback: "Well argued",
    decidedBy: "instructor",
    decidedAt: new Date("2026-11-19T10:10:00.000Z"),
  });
  const aliceSecond = ConceptChain.create({
    participantId: alice.participantId,
    roundNumber: 1,
    path: pathOnRow(2, 4),
    keywordIds: ["kw-11", "kw-12", "kw-13", "kw-14"],
    narrativeExplanation: "Alice's second chain",
    submittedAt: new Date("2026-11-19T10:03:00.000Z"),
  });
  session.addChain(bobChain, new Date());
  session.addChain(aliceFirst, new Date());
  session.addChain(aliceSecond, new Date());
  addMoreChains?.(session, carol.participantId);
  playOn?.(session, {
    aliceId: alice.participantId,
    bobId: bob.participantId,
    carolId: carol.participantId,
  });

  const otherSession = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });

  const sessionRepo = new InMemoryGameSessionRepository([session, otherSession]);
  const capabilityTokens = new HmacCapabilityTokenAdapter(SECRET);
  const handler = createListRoundChainsHandler({ sessionRepo, tokenVerifier: capabilityTokens });
  const sessionId = session.sessionId.value;

  return {
    session,
    sessionId,
    otherSessionId: otherSession.sessionId.value,
    alice,
    bob,
    carol,
    chains: { bobChain, aliceFirst, aliceSecond },
    capabilityTokens,
    instructorToken: () => capabilityTokens.signToken({ role: "instructor", sessionId }),
    participantToken: (participantId: string) =>
      capabilityTokens.signToken({ role: "participant", sessionId, participantId }),
    list: async (roundNumber: number | string, token?: string, forSessionId = sessionId) => {
      const response = await handler(makeEvent(forSessionId, roundNumber, token), {} as any);
      return {
        statusCode: response.statusCode as number,
        raw: response.body as string,
        body: JSON.parse(response.body),
      };
    },
  };
}

function chainIds(body: { chains: Array<{ chainId: string }> }): string[] {
  return body.chains.map(c => c.chainId);
}

function allRound1(world: ReturnType<typeof makeWorld>): string[] {
  return [
    world.chains.aliceFirst.chainId,
    world.chains.bobChain.chainId,
    world.chains.aliceSecond.chainId,
  ];
}

/** Moves Round 1 on to Round 2 chain-mapping, where Alice and Bob each submit one chain. */
function enterRound2WithChains(session: GameSession, aliceId: string, bobId: string): void {
  session.transitionTo("round-1:peer-adjudication", new Date());
  session.transitionTo("round-1:round-summary", new Date());
  session.transitionTo("round-2:chain-mapping", new Date());
  for (const [index, [chainId, participantId]] of ([
    ["r2-alice", aliceId],
    ["r2-bob", bobId],
  ] as const).entries()) {
    session.addChain(ConceptChain.create({
      chainId,
      participantId,
      roundNumber: 2,
      path: pathOnRow(index, 4),
      keywordIds: [],
      narrativeExplanation: chainId,
      submittedAt: new Date(`2026-11-19T11:0${index}:00.000Z`),
    }), new Date());
  }
}

describe("get /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains", () => {
  it("shows the instructor every learner's chains in submission order, with status, peer votes and verdict", async () => {
    const world = makeWorld();
    const { statusCode, body, raw } = await world.list(1, await world.instructorToken());

    expect(statusCode).toBe(200);
    expect(body.roundNumber).toBe(1);
    expect(body.chains.map((c: { chainId: string }) => c.chainId)).toEqual([
      world.chains.aliceFirst.chainId,
      world.chains.bobChain.chainId,
      world.chains.aliceSecond.chainId,
    ]);

    const [first, second] = body.chains;
    expect(first).toMatchObject({
      chainId: world.chains.aliceFirst.chainId,
      sessionId: world.sessionId,
      participantId: world.alice.participantId,
      roundNumber: 1,
      path: pathOnRow(0, 5),
      keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4", "kw-5"],
      narrativeExplanation: "Alice's first chain",
      stepRationales: ["a", "b", "c", "d"],
      chainLength: 5,
      status: "approved",
      submittedAt: "2026-11-19T10:01:00.000Z",
      verdict: {
        isApproved: true,
        isLocked: true,
        feedback: "Well argued",
        decidedBy: "instructor",
      },
    });
    expect(first.peerVotes).toHaveLength(1);
    expect(first.peerVotes[0]).toMatchObject({
      voterParticipantId: world.bob.participantId,
      decision: "approve",
      comment: "Holds up",
    });
    expect(second).toMatchObject({
      participantId: world.bob.participantId,
      status: "pending-review",
      peerVotes: [],
      verdict: null,
    });

    expect(raw).not.toContain(TEST_TEACHER.email);
    expect(raw).not.toContain(TEST_TEACHER.accountId);
    expect(raw).not.toMatch(/stack|at .*\.ts:\d+/i);
  });

  it("shows the submitting learner's display name on each listed chain", async () => {
    const world = makeWorld();
    const { body } = await world.list(1, await world.instructorToken());

    expect(
      body.chains.map((c: { participantId: string; participantDisplayName: string }) =>
        [c.participantId, c.participantDisplayName]),
    ).toEqual([
      [world.alice.participantId, "Alice"],
      [world.bob.participantId, "Bob"],
      [world.alice.participantId, "Alice"],
    ]);
  });

  it("shows the voter's display name on each peer vote, and the locked Instructor Final Ruling", async () => {
    const world = makeWorld();
    const { body } = await world.list(1, await world.instructorToken());

    const aliceFirst = body.chains[0];
    expect(aliceFirst.peerVotes).toEqual([
      expect.objectContaining({
        voterParticipantId: world.bob.participantId,
        voterDisplayName: "Bob",
        decision: "approve",
        comment: "Holds up",
      }),
    ]);
    expect(aliceFirst.verdict.isLocked).toBe(true);
  });

  it("shows \"Unknown\" for a chain author or voter who can't be found", async () => {
    const world = makeWorld((session) => {
      const ghostChain = ConceptChain.create({
        chainId: "ghost-chain",
        participantId: "no-such-participant",
        roundNumber: 1,
        path: pathOnRow(4, 4),
        keywordIds: [],
        narrativeExplanation: "Orphaned chain",
        submittedAt: new Date("2026-11-19T10:04:00.000Z"),
      });
      ghostChain.addPeerVote({ voterParticipantId: "no-such-voter", decision: "challenge" });
      session.addChain(ghostChain, new Date());
    });

    const { body } = await world.list(1, await world.instructorToken());

    const ghost = body.chains.find((c: { chainId: string }) => c.chainId === "ghost-chain");
    expect(ghost.participantDisplayName).toBe("Unknown");
    expect(ghost.peerVotes[0].voterDisplayName).toBe("Unknown");
  });

  it("shows no email address, account id or stack trace in the list response", async () => {
    const world = makeWorld();
    for (const token of [
      await world.instructorToken(),
      await world.participantToken(world.alice.participantId),
    ]) {
      const { raw } = await world.list(1, token);

      expect(raw).not.toContain(TEST_TEACHER.email);
      expect(raw).not.toContain(TEST_TEACHER.accountId);
      expect(raw).not.toMatch(/@/);
      expect(raw).not.toMatch(/stack|at .*\.ts:\d+/i);
    }
  });

  it("orders chains submitted at the same time by chain id", async () => {
    const sameTime = new Date("2026-11-19T10:05:00.000Z");
    const world = makeWorld((session, carolId) => {
      for (const [index, chainId] of ["chain-b", "chain-a"].entries()) {
        session.addChain(ConceptChain.create({
          chainId,
          participantId: carolId,
          roundNumber: 1,
          path: pathOnRow(3 + index, 4),
          keywordIds: [],
          narrativeExplanation: chainId,
          submittedAt: sameTime,
        }), new Date());
      }
    });

    const { body } = await world.list(1, await world.participantToken(world.carol.participantId));

    expect(body.chains.map((c: { chainId: string }) => c.chainId)).toEqual(["chain-a", "chain-b"]);
  });

  it("during Round 1 chain-mapping shows a participant only their own chains, and the instructor all of them", async () => {
    const world = makeWorld();
    const asAlice = await world.list(1, await world.participantToken(world.alice.participantId));
    const asInstructor = await world.list(1, await world.instructorToken());

    expect(world.session.currentPhase).toBe("round-1:chain-mapping");
    expect(asAlice.statusCode).toBe(200);
    expect(chainIds(asAlice.body)).toEqual([
      world.chains.aliceFirst.chainId,
      world.chains.aliceSecond.chainId,
    ]);
    expect(chainIds(asInstructor.body)).toEqual(allRound1(world));
  });

  it.each([
    ["round-1:peer-adjudication"],
    ["round-1:round-summary"],
  ] as const)("during %s shows a participant every Round 1 chain", async (phase) => {
    const world = makeWorld(undefined, (session) => {
      session.transitionTo("round-1:peer-adjudication", new Date());
      if (phase === "round-1:round-summary")
        session.transitionTo("round-1:round-summary", new Date());
    });

    const { statusCode, body } = await world.list(1, await world.participantToken(world.carol.participantId));

    expect(statusCode).toBe(200);
    expect(chainIds(body)).toEqual(allRound1(world));
  });

  it("while Round 2 is in chain-mapping shows a participant every Round 1 chain but only their own Round 2 chains", async () => {
    const world = makeWorld(undefined, (session, { aliceId, bobId }) => {
      enterRound2WithChains(session, aliceId, bobId);
    });
    const aliceToken = await world.participantToken(world.alice.participantId);

    const round1 = await world.list(1, aliceToken);
    const round2 = await world.list(2, aliceToken);

    expect(chainIds(round1.body)).toEqual(allRound1(world));
    expect(chainIds(round2.body)).toEqual(["r2-alice"]);
  });

  it("after the game is completed shows a participant every chain of both rounds", async () => {
    const world = makeWorld(undefined, (session, { aliceId, bobId }) => {
      enterRound2WithChains(session, aliceId, bobId);
      for (const phase of [
        "round-2:peer-adjudication",
        "round-2:round-summary",
        "posttest",
        "feedback-survey",
        "completed",
      ] as const) {
        session.transitionTo(phase, new Date());
      }
    });
    const carolToken = await world.participantToken(world.carol.participantId);

    const round1 = await world.list(1, carolToken);
    const round2 = await world.list(2, carolToken);

    expect(chainIds(round1.body)).toEqual(allRound1(world));
    expect(chainIds(round2.body)).toEqual(["r2-alice", "r2-bob"]);
  });

  it("returns an empty list for a participant with no chains", async () => {
    const world = makeWorld();
    const { statusCode, body } = await world.list(1, await world.participantToken(world.carol.participantId));

    expect(statusCode).toBe(200);
    expect(body).toEqual({ roundNumber: 1, chains: [] });
  });

  it("returns 200 with no chains for a round with no chains", async () => {
    const world = makeWorld();
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    const repo = new InMemoryGameSessionRepository([session]);
    const handler = createListRoundChainsHandler({ sessionRepo: repo, tokenVerifier: world.capabilityTokens });
    const token = await world.capabilityTokens.signToken({ role: "instructor", sessionId: session.sessionId.value });

    const response = await handler(makeEvent(session.sessionId.value, 1, token), {} as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ roundNumber: 1, chains: [] });
  });

  it("returns 200 with no chains for Round 2 before it starts", async () => {
    const world = makeWorld();
    const { statusCode, body } = await world.list(2, await world.instructorToken());

    expect(statusCode).toBe(200);
    expect(body).toEqual({ roundNumber: 2, chains: [] });
  });

  it("returns 404 SESSION_NOT_FOUND for an unknown session", async () => {
    const world = makeWorld();
    const token = await world.capabilityTokens.signToken({ role: "instructor", sessionId: "no-such-session" });

    const { statusCode, body } = await world.list(1, token, "no-such-session");

    expect(statusCode).toBe(404);
    expect(body.code).toBe("SESSION_NOT_FOUND");
  });

  it.each(["0", "3", "one"])("returns 400 for round %s", async (roundNumber) => {
    const world = makeWorld();
    const { statusCode, body } = await world.list(roundNumber, await world.instructorToken());

    expect(statusCode).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST_BODY");
    expect(body.message).toEqual(expect.any(String));
  });

  it.each([
    [
      "no token",
      async () => undefined,
    ],
    [
      "an invalid token",
      async () => "not-a-real-token",
    ],
    [
      "an expired token",
      async (world: ReturnType<typeof makeWorld>) =>
        new SignJWT({ kind: CAPABILITY_TOKEN_KIND, role: "instructor", sessionId: world.sessionId })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
          .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
          .sign(new TextEncoder().encode(SECRET)),
    ],
    [
      "an Account Token",
      async () => {
        const accountTokens = new HmacAccountTokenAdapter(SECRET);
        return (await accountTokens.signAccountToken(TEST_TEACHER, new Date())).token;
      },
    ],
  ])("refuses %s with 401 UNAUTHORIZED_TOKEN", async (_label, makeToken) => {
    const world = makeWorld();
    const { statusCode, body, raw } = await world.list(1, await makeToken(world));

    expect(statusCode).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED_TOKEN");
    expect(raw).not.toContain(TEST_TEACHER.email);
  });

  it("refuses another session's Capability Token with 403 FORBIDDEN_ROLE", async () => {
    const world = makeWorld();
    const token = await world.capabilityTokens.signToken({
      role: "instructor",
      sessionId: world.otherSessionId,
    });

    const { statusCode, body } = await world.list(1, token);

    expect(statusCode).toBe(403);
    expect(body.code).toBe("FORBIDDEN_ROLE");
  });
});
