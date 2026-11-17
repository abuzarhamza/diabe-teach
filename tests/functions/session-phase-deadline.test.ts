import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

function makeEvent(
  method: string,
  path: string,
  options: {
    body?: object;
    pathParameters?: Record<string, string>;
    token?: string;
  } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "content-type": "application/json",
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
    },
    queryStringParameters: null,
    pathParameters: options.pathParameters ?? null,
    body: options.body
      ? JSON.stringify(options.body)
      : null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

function makeHandlers(clock: FakeClock) {
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const tokenAdapter = new FakeCapabilityTokenAdapter();

  return {
    create: createCreateSessionHandler({
      packRepo,
      sessionRepo,
      tokenSigner: tokenAdapter,
      clock,
    }),
    join: createJoinSessionHandler({ sessionRepo, tokenSigner: tokenAdapter }),
    get: createGetSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    transition: createTransitionPhaseHandler({
      sessionRepo,
      tokenVerifier: tokenAdapter,
      clock,
    }),
  };
}

async function invoke(
  handler: (event: APIGatewayProxyEvent, context: any) => Promise<any>,
  event: APIGatewayProxyEvent,
) {
  const response = await handler(event, {} as any);
  return {
    statusCode: response.statusCode as number,
    body: JSON.parse(response.body),
  };
}

describe("session phase deadline (phaseEndsAt)", () => {
  it("reflects a custom roundMappingSec in phaseEndsAt from create, join, get-state and transition", async () => {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: { pretestSec: 60, trialOrientationSec: 30, roundMappingSec: 300 },
      },
    }));
    expect(created.statusCode).toBe(201);
    expect(created.body.state.phaseStartedAt).toBe("2026-03-01T09:00:00.000Z");
    expect(created.body.state.phaseEndsAt).toBe("2026-03-01T09:01:00.000Z");

    const { sessionId, roomCode, instructorToken } = created.body;
    const sessionPath = `/api/v1/sessions/${sessionId}`;

    const advance = async () =>
      invoke(handlers.transition, makeEvent("POST", `${sessionPath}/phase`, {
        body: { action: "advance" },
        pathParameters: { sessionId },
        token: instructorToken,
      }));

    clock.advanceSeconds(45);
    const toOrientation = await advance();
    expect(toOrientation.statusCode).toBe(200);
    expect(toOrientation.body.state.phaseStartedAt).toBe("2026-03-01T09:00:45.000Z");
    expect(toOrientation.body.state.phaseEndsAt).toBe("2026-03-01T09:01:15.000Z");

    clock.advanceSeconds(10);
    const toMapping = await advance();
    expect(toMapping.statusCode).toBe(200);
    expect(toMapping.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(toMapping.body.state.phaseStartedAt).toBe("2026-03-01T09:00:55.000Z");
    expect(toMapping.body.state.phaseEndsAt).toBe("2026-03-01T09:05:55.000Z");

    clock.advanceSeconds(20);
    const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
      body: { roomCode, displayName: "Alice" },
    }));
    expect(joined.statusCode).toBe(200);
    expect(joined.body.state.phaseEndsAt).toBe("2026-03-01T09:05:55.000Z");

    const state = await invoke(handlers.get, makeEvent("GET", sessionPath, {
      pathParameters: { sessionId },
      token: instructorToken,
    }));
    expect(state.statusCode).toBe(200);
    expect(state.body.state.phaseStartedAt).toBe("2026-03-01T09:00:55.000Z");
    expect(state.body.state.phaseEndsAt).toBe("2026-03-01T09:05:55.000Z");
  });

  it("uses the default timers when no timerConfig is given", async () => {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: { packId: "diabe-teach", mode: "classroom", adjudicationMode: "peer-instructor" },
    }));

    // Default pretest duration is 900 seconds (15 minutes).
    expect(created.body.state.phaseEndsAt).toBe("2026-03-01T09:15:00.000Z");

    const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
      body: { roomCode: created.body.roomCode, displayName: "Bob" },
    }));
    expect(joined.body.state.phaseEndsAt).toBe("2026-03-01T09:15:00.000Z");
  });
});
