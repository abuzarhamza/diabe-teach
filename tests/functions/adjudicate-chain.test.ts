import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  roundNumber: number,
  chainId: string,
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains/${chainId}/adjudicate`,
    headers: { "content-type": "application/json", ...headers },
    queryStringParameters: null,
    pathParameters: {
      sessionId,
      roundNumber: String(roundNumber),
      chainId,
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

describe("post /api/v1/sessions/{sessionId}/rounds/{n}/chains/{chainId}/adjudicate", () => {
  const makeSessionWithChain = () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    session.transitionTo("trial-orientation");
    session.transitionTo("round-1:chain-mapping");

    const participant = session.addParticipant("Alice");
    const chain = ConceptChain.create({
      participantId: participant.participantId,
      roundNumber: 1,
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
      narrativeExplanation: "Test chain",
    });
    session.addChain(chain);

    return { session, participant, chain };
  };

  it("allows peer to cast approve vote", async () => {
    const { session, chain } = makeSessionWithChain();
    const voter = session.addParticipant("Bob");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: voter.participantId,
    });

    const handler = createAdjudicateChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      chain.chainId,
      { action: "peer-approve" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.chain.peerVotes).toHaveLength(1);
    expect(body.chain.peerVotes[0].decision).toBe("approve");
  });

  it("allows instructor to approve with final ruling", async () => {
    const { session, chain } = makeSessionWithChain();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createAdjudicateChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      chain.chainId,
      {
        action: "instructor-approve",
        feedback: "Good clinical reasoning!",
        qualityScore: 85,
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.chain.verdict.isApproved).toBe(true);
    expect(body.chain.verdict.isLocked).toBe(true);
    expect(body.chain.status).toBe("approved");
  });

  it("allows instructor to reject with final ruling", async () => {
    const { session, chain } = makeSessionWithChain();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createAdjudicateChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      chain.chainId,
      {
        action: "instructor-reject",
        feedback: "Missing clinical justification.",
      },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.chain.verdict.isApproved).toBe(false);
    expect(body.chain.verdict.isLocked).toBe(true);
    expect(body.chain.status).toBe("rejected");
  });

  it("returns 404 when chain does not exist", async () => {
    const { session } = makeSessionWithChain();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createAdjudicateChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      "non-existent-chain",
      { action: "instructor-approve" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("CHAIN_NOT_FOUND");
  });

  it("returns 403 when participant tries instructor action", async () => {
    const { session, chain } = makeSessionWithChain();
    const voter = session.addParticipant("Charlie");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: voter.participantId,
    });

    const handler = createAdjudicateChainHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      1,
      chain.chainId,
      { action: "instructor-approve" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(403);
  });
});
