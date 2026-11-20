import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  roundNumber: number,
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains`,
    headers: { "content-type": "application/json", ...headers },
    queryStringParameters: null,
    pathParameters: {
      sessionId,
      roundNumber: String(roundNumber),
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

describe("post /api/v1/sessions/{sessionId}/rounds/{n}/chains", () => {
  const makeChainMappingSession = () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    return session;
  };

  it("submits a valid chain during chain-mapping phase", async () => {
    const session = makeChainMappingSession();
    const participant = session.addParticipant("Alice");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createSubmitChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "These concepts connect because...",
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.chain.chainId).toBeDefined();
    expect(body.chain.status).toBe("pending-review");
    expect(body.chain.chainLength).toBe(4);
  });

  it("returns 409 when not in chain-mapping phase", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    const participant = session.addParticipant("Bob");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createSubmitChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "Test",
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
  });

  it("returns 422 for chain shorter than minimum length", async () => {
    const session = makeChainMappingSession();
    const participant = session.addParticipant("Charlie");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createSubmitChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
      minChainLength: 4,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        keywordIds: ["kw-1", "kw-2"],
        narrativeExplanation: "Short chain",
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("CHAIN_TOPOLOGY_INVALID");
  });

  it("returns 422 for non-adjacent cells", async () => {
    const session = makeChainMappingSession();
    const participant = session.addParticipant("Diana");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createSubmitChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      {
        path: [
          { row: 0, col: 0 },
          { row: 5, col: 5 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "Non-adjacent chain",
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("CHAIN_TOPOLOGY_INVALID");
  });

  it("persists the chain to the session", async () => {
    const session = makeChainMappingSession();
    const participant = session.addParticipant("Eve");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createSubmitChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "Test chain",
      },
      { authorization: `Bearer ${token}` },
    );

    await handler(event, {} as any);

    const updated = await sessionRepo.findById(session.sessionId);
    expect(updated?.chains.length).toBe(1);
    expect(updated?.chains[0]?.participantId).toBe(participant.participantId);
  });
});

describe("post /api/v1/sessions/{sessionId}/rounds/{n}/chains for a round that is not running", () => {
  const validChain = {
    path: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ],
    keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
    narrativeExplanation: "These concepts connect because...",
  };

  const setUp = async (activeRound: 1 | 2) => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    const participant = session.addParticipant("Alice");
    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    if (activeRound === 2) {
      session.transitionTo("round-1:peer-adjudication", new Date());
      session.transitionTo("round-1:round-summary", new Date());
      session.transitionTo("round-2:chain-mapping", new Date());
    }
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();
    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });
    const handler = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    const submitTo = async (roundNumber: number) => handler(
      makeEvent(session.sessionId.value, roundNumber, validChain, {
        authorization: `Bearer ${token}`,
      }),
      {} as any,
    );
    const storedChains = async () => (await sessionRepo.findById(session.sessionId))?.chains ?? [];
    return { submitTo, storedChains };
  };

  it("rejects a chain sent to Round 2 during Round 1's Chain-Mapping and records nothing", async () => {
    const { submitTo, storedChains } = await setUp(1);

    const response = await submitTo(2);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    expect(await storedChains()).toHaveLength(0);
  });

  it("rejects a chain sent to Round 1 during Round 2's Chain-Mapping and records nothing", async () => {
    const { submitTo, storedChains } = await setUp(2);

    const response = await submitTo(1);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    expect(await storedChains()).toHaveLength(0);
  });

  it("accepts a chain sent to the active round", async () => {
    const { submitTo, storedChains } = await setUp(2);

    const response = await submitTo(2);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).chain.roundNumber).toBe(2);
    const chains = await storedChains();
    expect(chains).toHaveLength(1);
    expect(chains[0]?.roundNumber).toBe(2);
  });
});

describe("repeat Concept Chains from the same participant", () => {
  const CHAIN_PATH = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ];

  const chainBody = (
    path: readonly { row: number; col: number }[],
    narrativeExplanation = "These concepts connect because...",
  ) => ({
    path,
    keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
    narrativeExplanation,
  });

  async function setUp() {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig: { roundMappingSec: null },
    });
    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    const alice = session.addParticipant("Alice");
    const bob = session.addParticipant("Bob");
    const sessionId = session.sessionId.value;
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();
    const handler = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    const aliceToken = await tokenAdapter.signToken({ role: "participant", sessionId, participantId: alice.participantId });
    const bobToken = await tokenAdapter.signToken({ role: "participant", sessionId, participantId: bob.participantId });

    const submit = async (token: string, roundNumber: number, body: object) =>
      handler(makeEvent(sessionId, roundNumber, body, { authorization: `Bearer ${token}` }), {} as any);
    const storedChains = async () => (await sessionRepo.findById(session.sessionId))?.chains ?? [];

    return {
      session,
      sessionRepo,
      tokenAdapter,
      alice,
      bob,
      aliceToken,
      bobToken,
      submit,
      storedChains,
    };
  }

  it("rejects a participant re-submitting an identical chain in the same round with 409 CHAIN_ALREADY_SUBMITTED", async () => {
    const { aliceToken, submit, storedChains } = await setUp();

    const first = await submit(aliceToken, 1, chainBody(CHAIN_PATH));
    const repeat = await submit(aliceToken, 1, chainBody(CHAIN_PATH, "A different narrative"));

    expect(first.statusCode).toBe(201);
    expect(repeat.statusCode).toBe(409);
    expect(JSON.parse(repeat.body).code).toBe("CHAIN_ALREADY_SUBMITTED");
    expect(await storedChains()).toHaveLength(1);
  });

  it("rejects a participant submitting the reverse of their earlier chain in the same round", async () => {
    const { aliceToken, submit, storedChains } = await setUp();

    const first = await submit(aliceToken, 1, chainBody(CHAIN_PATH));
    const reversed = await submit(aliceToken, 1, chainBody([...CHAIN_PATH].reverse()));

    expect(first.statusCode).toBe(201);
    expect(reversed.statusCode).toBe(409);
    expect(JSON.parse(reversed.body).code).toBe("CHAIN_ALREADY_SUBMITTED");
    expect(await storedChains()).toHaveLength(1);
  });

  it("accepts the same chain from two different participants", async () => {
    const { alice, bob, aliceToken, bobToken, submit, storedChains } = await setUp();

    const fromAlice = await submit(aliceToken, 1, chainBody(CHAIN_PATH));
    const fromBob = await submit(bobToken, 1, chainBody(CHAIN_PATH));

    expect(fromAlice.statusCode).toBe(201);
    expect(fromBob.statusCode).toBe(201);
    expect((await storedChains()).map(chain => chain.participantId)).toEqual([alice.participantId, bob.participantId]);
  });

  it("accepts the same cells from the same participant in a different round", async () => {
    const { session, sessionRepo, tokenAdapter, aliceToken, submit, storedChains } = await setUp();
    const sessionId = session.sessionId.value;
    const instructorToken = await tokenAdapter.signToken({ role: "instructor", sessionId });
    const transitionPhase = createTransitionPhaseHandler({
      sessionRepo,
      packRepo: new InMemoryCurriculumPackRepository(),
      tokenVerifier: tokenAdapter,
    });
    const advance = async () => transitionPhase({
      ...makeEvent(sessionId, 1, { action: "advance" }, { authorization: `Bearer ${instructorToken}` }),
      path: `/api/v1/sessions/${sessionId}/phase`,
      pathParameters: { sessionId },
    }, {} as any);

    const inRound1 = await submit(aliceToken, 1, chainBody(CHAIN_PATH));
    // Round 1 peer-adjudication, then round summary, then Round 2 Chain-Mapping.
    expect((await advance()).statusCode).toBe(200);
    expect((await advance()).statusCode).toBe(200);
    expect((await advance()).statusCode).toBe(200);
    const inRound2 = await submit(aliceToken, 2, chainBody(CHAIN_PATH));

    expect(inRound1.statusCode).toBe(201);
    expect(inRound2.statusCode).toBe(201);
    expect((await storedChains()).map(chain => chain.roundNumber)).toEqual([1, 2]);
  });
});
