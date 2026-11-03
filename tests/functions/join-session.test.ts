import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  body: object,
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/api/v1/sessions/join",
    headers: { "content-type": "application/json" },
    queryStringParameters: null,
    pathParameters: null,
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    ...overrides,
  };
}

describe("post /api/v1/sessions/join", () => {
  const makeSession = () =>
    GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

  it("joins a session via room code and returns participant token", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const handler = createJoinSessionHandler({
      sessionRepo,
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent({
      roomCode: session.roomCode.value,
      displayName: "Alice",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBe(session.sessionId.value);
    expect(body.participantId).toBeDefined();
    expect(body.participantToken).toBeDefined();
    expect(body.state.participantCount).toBe(1);
  });

  it("normalizes room code to uppercase", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const handler = createJoinSessionHandler({
      sessionRepo,
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent({
      roomCode: session.roomCode.value.toLowerCase(),
      displayName: "Bob",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
  });

  it("returns 404 when room code does not exist", async () => {
    const sessionRepo = new InMemoryGameSessionRepository();
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const handler = createJoinSessionHandler({
      sessionRepo,
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent({
      roomCode: "XXXXXX",
      displayName: "Charlie",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("ROOM_CODE_NOT_FOUND");
  });

  it("persists the new participant to the session", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const handler = createJoinSessionHandler({
      sessionRepo,
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent({
      roomCode: session.roomCode.value,
      displayName: "Diana",
    });

    await handler(event, {} as any);

    const updated = await sessionRepo.findById(session.sessionId);
    expect(updated?.participantCount).toBe(1);
    expect(updated?.participants[0]?.displayName).toBe("Diana");
  });
});
