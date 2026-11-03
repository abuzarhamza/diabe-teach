import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createGetStandingsHandler } from "../../netlify/functions/sessions/get-standings.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  roundNumber: number,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/standings`,
    headers,
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

describe("get /api/v1/sessions/{sessionId}/rounds/{n}/standings", () => {
  const makeSessionWithApprovedChains = () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    session.transitionTo("trial-orientation");
    session.transitionTo("round-1:chain-mapping");

    const alice = session.addParticipant("Alice");
    const bob = session.addParticipant("Bob");

    const aliceChain = ConceptChain.create({
      participantId: alice.participantId,
      roundNumber: 1,
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ],
      keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4", "kw-5"],
      narrativeExplanation: "Alice's chain",
    });
    aliceChain.setVerdict({
      isApproved: true,
      isLocked: true,
      decidedBy: "instructor",
      decidedAt: new Date(),
    });
    session.addChain(aliceChain);

    const bobChain = ConceptChain.create({
      participantId: bob.participantId,
      roundNumber: 1,
      path: [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
      keywordIds: ["kw-6", "kw-7", "kw-8", "kw-9"],
      narrativeExplanation: "Bob's chain",
    });
    bobChain.setVerdict({
      isApproved: true,
      isLocked: true,
      decidedBy: "instructor",
      decidedAt: new Date(),
    });
    session.addChain(bobChain);

    return { session, alice, bob };
  };

  it("returns standings sorted by longest chain", async () => {
    const { session, alice } = makeSessionWithApprovedChains();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: alice.participantId,
    });

    const handler = createGetStandingsHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value, 1, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.standings).toHaveLength(2);
    expect(body.standings[0].displayName).toBe("Alice");
    expect(body.standings[0].longestValidChainLength).toBe(5);
    expect(body.standings[0].rank).toBe(1);
    expect(body.standings[1].displayName).toBe("Bob");
    expect(body.standings[1].longestValidChainLength).toBe(4);
    expect(body.standings[1].rank).toBe(2);
  });

  it("returns empty standings when no approved chains", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    session.transitionTo("trial-orientation");
    session.transitionTo("round-1:chain-mapping");
    const participant = session.addParticipant("Charlie");

    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createGetStandingsHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value, 1, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.standings).toHaveLength(0);
  });

  it("returns 404 when session does not exist", async () => {
    const sessionRepo = new InMemoryGameSessionRepository();
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: "non-existent",
      participantId: "p-1",
    });

    const handler = createGetStandingsHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent("non-existent", 1, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
  });
});
