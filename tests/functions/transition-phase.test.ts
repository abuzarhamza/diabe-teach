import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/phase`,
    headers: { "content-type": "application/json", ...headers },
    queryStringParameters: null,
    pathParameters: { sessionId },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

describe("post /api/v1/sessions/{sessionId}/phase", () => {
  const makeSession = () =>
    GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

  it("advances phase from pretest to trial-orientation", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      { action: "advance" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.currentPhase).toBe("trial-orientation");
  });

  it("advances through full phase progression", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const phases = [
      "trial-orientation",
      "round-1:chain-mapping",
      "round-1:peer-adjudication",
      "round-1:round-summary",
      "round-2:chain-mapping",
    ];

    for (const expectedPhase of phases) {
      const event = makeEvent(
        session.sessionId.value,
        { action: "advance" },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as any);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.currentPhase).toBe(expectedPhase);
    }
  });

  it("returns 409 for invalid phase transition", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      { action: "jump", targetPhase: "completed" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("INVALID_PHASE_TRANSITION");
  });

  it("returns 403 when participant tries to transition", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: "p-1",
    });

    const handler = createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      { action: "advance" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(403);
  });

  it("sets activeRoundNumber when entering round-1:chain-mapping", async () => {
    const session = makeSession();
    session.transitionTo("trial-orientation");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(
      session.sessionId.value,
      { action: "advance" },
      { authorization: `Bearer ${token}` },
    );

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(body.state.activeRoundNumber).toBe(1);
  });
});
