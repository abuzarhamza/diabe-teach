import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createExtendPhaseHandler } from "../../netlify/functions/sessions/extend-phase.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { createSignedInCreateSessionHandler } from "./support/signed-in-teacher.js";

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

/**
 * Creates a classroom session (timers from `timerConfig`), joins one learner
 * and advances to Round 1 Chain-Mapping, which starts at 09:00:00.
 */
async function startRound(timerConfig: Record<string, number | null>) {
  const clock = new FakeClock(new Date("2026-03-01T08:59:00.000Z"));
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const handlers = {
    create: createSignedInCreateSessionHandler({
      packRepo,
      sessionRepo,
      tokenSigner: tokenAdapter,
      clock,
    }),
    join: createJoinSessionHandler({ sessionRepo, tokenSigner: tokenAdapter }),
    get: createGetSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    transition: createTransitionPhaseHandler({
      sessionRepo,
      packRepo,
      tokenVerifier: tokenAdapter,
      clock,
    }),
    extend: createExtendPhaseHandler({ sessionRepo, tokenVerifier: tokenAdapter, clock }),
    submitChain: createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter, clock }),
  };

  const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
    body: {
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig,
    },
  }));
  const { sessionId, roomCode, instructorToken } = created.body;
  const sessionPath = `/api/v1/sessions/${sessionId}`;

  const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
    body: { roomCode, displayName: "Alice" },
  }));
  const participantToken: string = joined.body.participantToken;

  const advance = async () =>
    invoke(handlers.transition, makeEvent("POST", `${sessionPath}/phase`, {
      body: { action: "advance" },
      pathParameters: { sessionId },
      token: instructorToken,
    }));

  const extend = async (body: object, token: string = instructorToken) =>
    invoke(handlers.extend, makeEvent("POST", `${sessionPath}/phase/extend`, {
      body,
      pathParameters: { sessionId },
      token,
    }));

  const submitChain = async () =>
    invoke(handlers.submitChain, makeEvent("POST", `${sessionPath}/rounds/1/chains`, {
      body: {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        narrativeExplanation: "These concepts connect because...",
      },
      pathParameters: { sessionId, roundNumber: "1" },
      token: participantToken,
    }));

  const getState = async () =>
    invoke(handlers.get, makeEvent("GET", sessionPath, {
      pathParameters: { sessionId },
      token: instructorToken,
    }));

  await advance(); // trial-orientation
  clock.setNow(new Date("2026-03-01T09:00:00.000Z"));
  const toMapping = await advance();
  expect(toMapping.body.state.currentPhase).toBe("round-1:chain-mapping");

  return {
    clock,
    advance,
    extend,
    submitChain,
    getState,
    participantToken,
  };
}

describe("extend the current phase (POST /sessions/{sessionId}/phase/extend)", () => {
  it("moves phaseEndsAt of a running timed phase by the given seconds", async () => {
    const round = await startRound({ roundMappingSec: 300 });

    round.clock.setNow(new Date("2026-03-01T09:02:00.000Z"));
    const extended = await round.extend({ seconds: 60 });

    expect(extended.statusCode).toBe(200);
    expect(extended.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(extended.body.state.phaseEndsAt).toBe("2026-03-01T09:06:00.000Z");

    const again = await round.extend({ seconds: 30 });
    expect(again.body.state.phaseEndsAt).toBe("2026-03-01T09:06:30.000Z");

    const state = await round.getState();
    expect(state.body.state.phaseEndsAt).toBe("2026-03-01T09:06:30.000Z");
  });

  it("reopens chain submissions when extended after the phase ran out", async () => {
    const round = await startRound({ roundMappingSec: 300 });

    round.clock.setNow(new Date("2026-03-01T09:10:00.000Z"));
    const late = await round.submitChain();
    expect(late.body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");

    const extended = await round.extend({ seconds: 120 });
    expect(extended.statusCode).toBe(200);
    // max(phaseEndsAt, now) + seconds: counted from now, as the deadline has passed.
    expect(extended.body.state.phaseEndsAt).toBe("2026-03-01T09:12:00.000Z");

    round.clock.setNow(new Date("2026-03-01T09:11:30.000Z"));
    const inAddedTime = await round.submitChain();
    expect(inAddedTime.statusCode).toBe(201);
  });

  it("drops the extension when the phase transitions", async () => {
    const round = await startRound({ roundMappingSec: 300, roundAdjudicationSec: 120 });

    await round.extend({ seconds: 600 });
    round.clock.setNow(new Date("2026-03-01T09:01:00.000Z"));
    const next = await round.advance();

    expect(next.body.state.currentPhase).toBe("round-1:peer-adjudication");
    expect(next.body.state.phaseEndsAt).toBe("2026-03-01T09:03:00.000Z");
  });

  it("refuses an instructor-driven phase with 409 PHASE_HAS_NO_TIMER", async () => {
    const round = await startRound({ roundMappingSec: null });

    const refused = await round.extend({ seconds: 60 });

    expect(refused.statusCode).toBe(409);
    expect(refused.body.code).toBe("PHASE_HAS_NO_TIMER");
  });

  it("refuses a completed session with 409 SESSION_ALREADY_COMPLETED", async () => {
    const round = await startRound({ roundMappingSec: 300 });
    let phase = "";
    while (phase !== "completed") {
      phase = (await round.advance()).body.state.currentPhase;
    }

    const refused = await round.extend({ seconds: 60 });

    expect(refused.statusCode).toBe(409);
    expect(refused.body.code).toBe("SESSION_ALREADY_COMPLETED");
  });

  it.each([0, 601, 1.5])("rejects seconds %s with 400", async (seconds) => {
    const round = await startRound({ roundMappingSec: 300 });

    const rejected = await round.extend({ seconds });

    expect(rejected.statusCode).toBe(400);
    expect(rejected.body.code).toBe("INVALID_REQUEST_BODY");
  });

  it("rejects a missing seconds with 400", async () => {
    const round = await startRound({ roundMappingSec: 300 });

    const rejected = await round.extend({});

    expect(rejected.statusCode).toBe(400);
  });

  it("forbids a participant token with 403", async () => {
    const round = await startRound({ roundMappingSec: 300 });

    const forbidden = await round.extend({ seconds: 60 }, round.participantToken);

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN_ROLE");
  });
});
