import type { APIGatewayProxyEvent } from "aws-lambda";
import type { PhaseIdentifier } from "../../src/domain/game-session/game-session.types.js";
import { describe, expect, it } from "vitest";
import { createEndSessionHandler } from "../../netlify/functions/sessions/end-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { PHASE_ORDER } from "../../src/domain/game-session/game-session.types.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";

const START = new Date("2026-03-01T09:00:00.000Z");

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

/** A classroom session moved forward phase by phase to `phase`, stored with one learner. */
async function sessionIn(phase: PhaseIdentifier) {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    timerConfig: { roundMappingSec: 300 },
  });
  for (const next of PHASE_ORDER.slice(1, PHASE_ORDER.indexOf(phase) + 1)) {
    session.transitionTo(next, START);
  }
  const sessionId = session.sessionId.value;
  const clock = new FakeClock(new Date("2026-03-01T09:01:00.000Z"));
  const sessionRepo = new InMemoryGameSessionRepository([session]);
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const instructorToken = await tokenAdapter.signToken({ role: "instructor", sessionId });
  const handlers = {
    end: createEndSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter, clock }),
    get: createGetSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    join: createJoinSessionHandler({ sessionRepo, tokenSigner: tokenAdapter }),
    submitChain: createSubmitChainHandler({
      packRepo: new InMemoryCurriculumPackRepository(),
      sessionRepo,
      tokenVerifier: tokenAdapter,
      clock,
    }),
  };
  const sessionPath = `/api/v1/sessions/${sessionId}`;

  const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
    body: { roomCode: session.roomCode.value, displayName: "Alice" },
  }));
  const participantToken: string = joined.body.participantToken;

  const end = async (token: string = instructorToken) =>
    invoke(handlers.end, makeEvent("POST", `${sessionPath}/end`, {
      pathParameters: { sessionId },
      token,
    }));

  const getState = async (token: string) =>
    invoke(handlers.get, makeEvent("GET", sessionPath, {
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

  return {
    clock,
    sessionRepo,
    sessionId,
    end,
    getState,
    submitChain,
    participantToken,
  };
}

const notCompleted = PHASE_ORDER.filter(phase => phase !== "completed");

describe("end the session early (POST /sessions/{sessionId}/end)", () => {
  it.each(notCompleted)("moves a session in %s straight to completed", async (phase) => {
    const s = await sessionIn(phase);

    const ended = await s.end();

    expect(ended.statusCode).toBe(200);
    expect(ended.body.state.currentPhase).toBe("completed");
    expect(ended.body.state.phaseStartedAt).toBe("2026-03-01T09:01:00.000Z");
    // No deadline in the future: `completed` has no timer.
    const endsAt = ended.body.state.phaseEndsAt as string | null;
    expect(endsAt === null || Date.parse(endsAt) <= Date.parse(ended.body.state.phaseStartedAt)).toBe(true);
  });

  it("drops an extension of the phase it ends", async () => {
    const s = await sessionIn("round-1:chain-mapping");
    const stored = await s.sessionRepo.findById(SessionId.from(s.sessionId));
    stored!.extendPhase(600, s.clock.now());
    await s.sessionRepo.update(stored!);

    const ended = await s.end();

    expect(ended.statusCode).toBe(200);
    const reloaded = await s.sessionRepo.findById(SessionId.from(s.sessionId));
    expect(reloaded!.extendedPhaseEndsAt).toBeNull();
    expect(ended.body.state.phaseEndsAt).not.toBe(stored!.extendedPhaseEndsAt!.toISOString());
  });

  it("refuses ending twice with 409 SESSION_ALREADY_COMPLETED", async () => {
    const s = await sessionIn("round-1:peer-adjudication");
    expect((await s.end()).statusCode).toBe(200);

    const again = await s.end();

    expect(again.statusCode).toBe(409);
    expect(again.body.code).toBe("SESSION_ALREADY_COMPLETED");
  });

  it("refuses a session that reached completed by advancing with 409 SESSION_ALREADY_COMPLETED", async () => {
    const s = await sessionIn("completed");

    const refused = await s.end();

    expect(refused.statusCode).toBe(409);
    expect(refused.body.code).toBe("SESSION_ALREADY_COMPLETED");
  });

  it("forbids a participant token with 403", async () => {
    const s = await sessionIn("round-1:chain-mapping");

    const forbidden = await s.end(s.participantToken);

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN_ROLE");
    expect((await s.getState(s.participantToken)).body.state.currentPhase).toBe("round-1:chain-mapping");
  });

  it("refuses a missing token with 401", async () => {
    const s = await sessionIn("pretest");

    const response = await invoke(
      createEndSessionHandler({
        sessionRepo: s.sessionRepo,
        tokenVerifier: new FakeCapabilityTokenAdapter(),
      }),
      makeEvent("POST", `/api/v1/sessions/${s.sessionId}/end`, {
        pathParameters: { sessionId: s.sessionId },
      }),
    );

    expect(response.statusCode).toBe(401);
  });

  it("closes chain submission mid-round, and the learner's state shows completed", async () => {
    const s = await sessionIn("round-1:chain-mapping");
    expect((await s.submitChain()).statusCode).toBe(201);

    await s.end();

    const late = await s.submitChain();
    expect(late.statusCode).toBe(409);
    expect(late.body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    const learnerView = await s.getState(s.participantToken);
    expect(learnerView.body.state.currentPhase).toBe("completed");
  });
});
