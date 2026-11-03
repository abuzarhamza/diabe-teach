import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

function makeEvent(
  body: object,
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/api/v1/sessions",
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

describe("post /api/v1/sessions", () => {
  const makeDeps = () => ({
    packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
    sessionRepo: new InMemoryGameSessionRepository(),
    tokenSigner: new FakeCapabilityTokenAdapter(),
    tokenVerifier: new FakeCapabilityTokenAdapter(),
    apiKey: undefined,
    requireApiKey: false,
  });

  it("creates a classroom session and returns sessionId, roomCode, instructorToken", async () => {
    const deps = makeDeps();
    const handler = createCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBeDefined();
    expect(body.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.instructorToken).toBeDefined();
    expect(body.state.currentPhase).toBe("pretest");
    expect(body.state.packId).toBe("diabe-teach");
    expect(body.participantId).toBeNull();
    expect(body.participantToken).toBeNull();
  });

  it("creates a solo session with auto-joined participant", async () => {
    const deps = makeDeps();
    const handler = createCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "solo",
      adjudicationMode: "ai",
      creatorDisplayName: "Alice",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBeDefined();
    expect(body.instructorToken).toBeDefined();
    expect(body.participantId).toBeDefined();
    expect(body.participantToken).toBeDefined();
    expect(body.state.participantCount).toBe(1);
  });

  it("returns 404 when packId does not exist", async () => {
    const deps = makeDeps();
    const handler = createCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "unknown-pack",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("PACK_NOT_FOUND");
  });

  it("persists the session to the repository", async () => {
    const deps = makeDeps();
    const handler = createCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);
    const body = JSON.parse(response.body);

    const { SessionId } = await import(
      "../../src/domain/game-session/session-id.js",
    );
    const saved = await deps.sessionRepo.findById(
      SessionId.from(body.sessionId),
    );
    expect(saved).not.toBeNull();
    expect(saved?.packId).toBe("diabe-teach");
  });
});
