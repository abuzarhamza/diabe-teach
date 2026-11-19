import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
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

function makeHandlers(clock: FakeClock) {
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const tokenAdapter = new FakeCapabilityTokenAdapter();

  return {
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
    submitChain: createSubmitChainHandler({
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

describe("chain-mapping deadline enforcement", () => {
  const ROUND_MAPPING_SEC = 300;

  /**
   * Creates a classroom session with a 5-minute Chain-Mapping phase, joins one
   * participant, and advances to round 1 Chain-Mapping, which starts at
   * 09:00:00 and ends at 09:05:00.
   */
  async function startTimedRound() {
    const clock = new FakeClock(new Date("2026-03-01T08:59:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: { roundMappingSec: ROUND_MAPPING_SEC },
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

    await advance(); // trial-orientation
    clock.setNow(new Date("2026-03-01T09:00:00.000Z"));
    const toMapping = await advance();
    expect(toMapping.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(toMapping.body.state.phaseEndsAt).toBe("2026-03-01T09:05:00.000Z");

    const submitChain = async (path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]) =>
      invoke(handlers.submitChain, makeEvent("POST", `${sessionPath}/rounds/1/chains`, {
        body: {
          path,
          keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
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

    return {
      clock,
      advance,
      submitChain,
      getState,
    };
  }

  it("rejects a chain submitted more than 5 seconds after phaseEndsAt", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:05:05.001Z"));
    const late = await round.submitChain();

    expect(late.statusCode).toBe(409);
    expect(late.body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    expect(late.body.details).toEqual({
      currentPhase: "round-1:chain-mapping",
      phaseEndsAt: "2026-03-01T09:05:00.000Z",
      gracePeriodSec: 5,
    });
  });

  it("accepts a chain submitted before phaseEndsAt", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:04:59.000Z"));
    const onTime = await round.submitChain();

    expect(onTime.statusCode).toBe(201);
    expect(onTime.body.chain.status).toBe("pending-review");
  });

  it("accepts a chain submitted within the 5-second grace window after phaseEndsAt", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:05:02.000Z"));
    const insideGrace = await round.submitChain();
    expect(insideGrace.statusCode).toBe(201);

    round.clock.setNow(new Date("2026-03-01T09:05:05.000Z"));
    // A different chain: the same participant cannot repeat the first one.
    const atGraceEnd = await round.submitChain([
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 2 },
    ]);
    expect(atGraceEnd.statusCode).toBe(201);
  });

  it("keeps the phase in chain-mapping after the deadline until the instructor transitions", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:30:00.000Z"));
    const rejected = await round.submitChain();
    expect(rejected.body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");

    const state = await round.getState();
    expect(state.statusCode).toBe(200);
    expect(state.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(state.body.state.phaseEndsAt).toBe("2026-03-01T09:05:00.000Z");
  });

  it("lets the instructor transition to peer-adjudication before the deadline", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:02:00.000Z"));
    const early = await round.advance();

    expect(early.statusCode).toBe(200);
    expect(early.body.state.currentPhase).toBe("round-1:peer-adjudication");
    expect(early.body.state.phaseStartedAt).toBe("2026-03-01T09:02:00.000Z");
  });

  it("lets the instructor transition to peer-adjudication after the deadline", async () => {
    const round = await startTimedRound();

    round.clock.setNow(new Date("2026-03-01T09:30:00.000Z"));
    const late = await round.advance();

    expect(late.statusCode).toBe(200);
    expect(late.body.state.currentPhase).toBe("round-1:peer-adjudication");
    expect(late.body.state.phaseStartedAt).toBe("2026-03-01T09:30:00.000Z");
  });
});

describe("instructor-driven (untimed) phases", () => {
  /**
   * Creates a classroom session with the given timer config at 09:00:00,
   * joins one participant, and returns helpers for driving the session.
   */
  async function startSession(timerConfig: Record<string, number | null>) {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig,
      },
    }));
    expect(created.statusCode).toBe(201);
    const { sessionId, roomCode, instructorToken } = created.body;
    const sessionPath = `/api/v1/sessions/${sessionId}`;

    const join = async (displayName: string) =>
      invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
        body: { roomCode, displayName },
      }));

    const advance = async () =>
      invoke(handlers.transition, makeEvent("POST", `${sessionPath}/phase`, {
        body: { action: "advance" },
        pathParameters: { sessionId },
        token: instructorToken,
      }));

    const getState = async () =>
      invoke(handlers.get, makeEvent("GET", sessionPath, {
        pathParameters: { sessionId },
        token: instructorToken,
      }));

    const submitChain = async (participantToken: string) =>
      invoke(handlers.submitChain, makeEvent("POST", `${sessionPath}/rounds/1/chains`, {
        body: {
          path: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 1, col: 1 },
            { row: 1, col: 2 },
          ],
          keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
          narrativeExplanation: "These concepts connect because...",
        },
        pathParameters: { sessionId, roundNumber: "1" },
        token: participantToken,
      }));

    return {
      clock,
      created,
      join,
      advance,
      getState,
      submitChain,
    };
  }

  it("reports phaseEndsAt as null in create, join, get-state and transition once an untimed chain-mapping phase starts", async () => {
    const session = await startSession({ roundMappingSec: null });

    // Omitted fields keep their defaults: pretest is 900 seconds.
    expect(session.created.body.state.phaseEndsAt).toBe("2026-03-01T09:15:00.000Z");

    await session.advance(); // trial-orientation
    const toMapping = await session.advance();
    expect(toMapping.statusCode).toBe(200);
    expect(toMapping.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(toMapping.body.state).toHaveProperty("phaseEndsAt", null);

    const joined = await session.join("Alice");
    expect(joined.statusCode).toBe(200);
    expect(joined.body.state).toHaveProperty("phaseEndsAt", null);

    const state = await session.getState();
    expect(state.statusCode).toBe(200);
    expect(state.body.state).toHaveProperty("phaseEndsAt", null);
  });

  it("reports phaseEndsAt as null from create when the first phase is untimed", async () => {
    const session = await startSession({ pretestSec: null });

    expect(session.created.body.state.currentPhase).toBe("pretest");
    expect(session.created.body.state).toHaveProperty("phaseEndsAt", null);
  });

  it("accepts a chain submitted long after an untimed chain-mapping phase started", async () => {
    const session = await startSession({ roundMappingSec: null });
    const joined = await session.join("Alice");
    await session.advance(); // trial-orientation
    await session.advance(); // round-1:chain-mapping

    session.clock.advanceSeconds(6 * 60 * 60);
    const submitted = await session.submitChain(joined.body.participantToken);

    expect(submitted.statusCode).toBe(201);
    expect(submitted.body.chain.status).toBe("pending-review");
  });

  it("applies each phase's own timer in a mixed config (timed chain-mapping, untimed peer-adjudication)", async () => {
    const session = await startSession({ roundMappingSec: 300, roundAdjudicationSec: null });
    const joined = await session.join("Alice");
    await session.advance(); // trial-orientation
    const toMapping = await session.advance();
    expect(toMapping.body.state.currentPhase).toBe("round-1:chain-mapping");
    expect(toMapping.body.state.phaseEndsAt).toBe("2026-03-01T09:05:00.000Z");

    session.clock.advanceSeconds(10 * 60);
    const late = await session.submitChain(joined.body.participantToken);
    expect(late.statusCode).toBe(409);
    expect(late.body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");

    const toAdjudication = await session.advance();
    expect(toAdjudication.statusCode).toBe(200);
    expect(toAdjudication.body.state.currentPhase).toBe("round-1:peer-adjudication");
    expect(toAdjudication.body.state).toHaveProperty("phaseEndsAt", null);
  });

  it.each([
    ["zero", 0],
    ["negative", -60],
    ["fractional", 1.5],
    ["non-numeric", "300"],
    ["longer than 24 hours", 86_401],
    ["date-overflowing", 1e16],
  ])("rejects a %s timer duration at create time with INVALID_REQUEST_BODY", async (_label, value) => {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: { roundMappingSec: value },
      },
    }));

    expect(created.statusCode).toBe(400);
    expect(created.body.code).toBe("INVALID_REQUEST_BODY");
    expect(created.body.details).toEqual({ field: "roundMappingSec", value });
  });

  it("rejects an unknown timer field at create time with INVALID_REQUEST_BODY", async () => {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig: { roundMapingSec: null },
      },
    }));

    expect(created.statusCode).toBe(400);
    expect(created.body.code).toBe("INVALID_REQUEST_BODY");
    expect(created.body.details).toEqual({ field: "roundMapingSec", value: null });
  });

  it.each([
    ["a string", "none"],
    ["an array", []],
    ["null", null],
  ])("rejects timerConfig given as %s with INVALID_REQUEST_BODY", async (_label, timerConfig) => {
    const clock = new FakeClock(new Date("2026-03-01T09:00:00.000Z"));
    const handlers = makeHandlers(clock);

    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        timerConfig,
      },
    }));

    expect(created.statusCode).toBe(400);
    expect(created.body.code).toBe("INVALID_REQUEST_BODY");
  });
});
