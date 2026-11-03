import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
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
    session.transitionTo("trial-orientation");
    session.transitionTo("round-1:chain-mapping");
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
