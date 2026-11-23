import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: `/api/v1/sessions/${sessionId}`,
    headers,
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

describe("get /api/v1/sessions/{sessionId}", () => {
  const makeSession = () =>
    GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

  it("returns session state for valid instructor token", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: session.sessionId.value,
    });

    const handler = createGetSessionHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.sessionId).toBe(session.sessionId.value);
    expect(body.state.packId).toBe("diabe-teach");
    expect(body.state.currentPhase).toBe("pretest");
  });

  it("returns session state for valid participant token", async () => {
    const session = makeSession();
    const participant = session.addParticipant("Alice");
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const handler = createGetSessionHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
  });

  async function stateAs(
    session: GameSession,
    claims: { role: "instructor" | "participant"; participantId?: string },
  ) {
    const tokenAdapter = new FakeCapabilityTokenAdapter();
    const token = await tokenAdapter.signToken({
      ...claims,
      sessionId: session.sessionId.value,
    });
    const handler = createGetSessionHandler({
      sessionRepo: new InMemoryGameSessionRepository([session]),
      tokenVerifier: tokenAdapter,
    });
    const response = await handler(
      makeEvent(session.sessionId.value, { authorization: `Bearer ${token}` }),
      {} as any,
    );
    expect(response.statusCode).toBe(200);
    return { raw: response.body, state: JSON.parse(response.body).state };
  }

  it("lists every learner who joined to both the instructor and a participant", async () => {
    const session = makeSession();
    const alice = session.addParticipant("Alice");
    const bob = session.addParticipant("Bob");
    const expected = [
      {
        participantId: alice.participantId,
        displayName: "Alice",
        joinedAt: alice.joinedAt.toISOString(),
        leftAt: null,
      },
      {
        participantId: bob.participantId,
        displayName: "Bob",
        joinedAt: bob.joinedAt.toISOString(),
        leftAt: null,
      },
    ];

    const asInstructor = await stateAs(session, { role: "instructor" });
    const asParticipant = await stateAs(session, {
      role: "participant",
      participantId: bob.participantId,
    });

    expect(asInstructor.state.participants).toEqual(expected);
    expect(asParticipant.state.participants).toEqual(expected);
    expect(asInstructor.state.participantCount).toBe(2);
    expect(asParticipant.state.participantCount).toBe(2);
  });

  it("puts no email or account id in the state", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      ownerAccountId: "acc_owner_123",
    });
    session.addParticipant("Alice");

    const { raw, state } = await stateAs(session, { role: "instructor" });

    expect(raw).not.toContain("acc_owner_123");
    expect(raw).not.toMatch(/email/i);
    expect(raw).not.toMatch(/accountId/i);
    for (const participant of state.participants) {
      expect(Object.keys(participant).sort()).toEqual([
        "displayName",
        "joinedAt",
        "leftAt",
        "participantId",
      ]);
    }
  });

  it("returns 404 when session does not exist", async () => {
    const sessionRepo = new InMemoryGameSessionRepository();
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: "non-existent",
    });

    const handler = createGetSessionHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent("non-existent", {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns 401 when no authorization header", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const handler = createGetSessionHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value);

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(401);
  });

  it("returns 403 when token sessionId does not match", async () => {
    const session = makeSession();
    const sessionRepo = new InMemoryGameSessionRepository([session]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();

    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: "different-session",
    });

    const handler = createGetSessionHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
    });

    const event = makeEvent(session.sessionId.value, {
      authorization: `Bearer ${token}`,
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(403);
  });
});
