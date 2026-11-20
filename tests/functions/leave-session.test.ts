import type { APIGatewayProxyEvent } from "aws-lambda";
import type { PhaseIdentifier } from "../../src/domain/game-session/game-session.types.js";
import { describe, expect, it } from "vitest";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createGetStandingsHandler } from "../../netlify/functions/sessions/get-standings.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createLeaveSessionHandler } from "../../netlify/functions/sessions/leave-session.js";
import { createListRoundChainsHandler } from "../../netlify/functions/sessions/list-round-chains.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { PHASE_ORDER } from "../../src/domain/game-session/game-session.types.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";

const START = new Date("2026-03-01T09:00:00.000Z");
const LEFT_AT = "2026-03-01T09:01:00.000Z";

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

const CHAIN_PATH = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
];

const OTHER_CHAIN_PATH = [
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
];

/** A stored classroom session in `pretest` with two learners, Alice and Bob. */
async function classroomWithTwoLearners() {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    timerConfig: { roundMappingSec: 300 },
  });
  const sessionId = session.sessionId.value;
  const clock = new FakeClock(new Date(LEFT_AT));
  const sessionRepo = new InMemoryGameSessionRepository([session]);
  const packRepo = new InMemoryCurriculumPackRepository();
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const instructorToken = await tokenAdapter.signToken({ role: "instructor", sessionId });
  const handlers = {
    leave: createLeaveSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter, clock }),
    get: createGetSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    join: createJoinSessionHandler({ sessionRepo, tokenSigner: tokenAdapter }),
    submitChain: createSubmitChainHandler({
      packRepo: new InMemoryCurriculumPackRepository(),
      sessionRepo,
      tokenVerifier: tokenAdapter,
      clock,
    }),
    adjudicate: createAdjudicateChainHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    listChains: createListRoundChainsHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    standings: createGetStandingsHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    assessment: createSubmitAssessmentHandler({ sessionRepo, packRepo, tokenVerifier: tokenAdapter }),
    survey: createSubmitSurveyHandler({ sessionRepo, packRepo, tokenVerifier: tokenAdapter }),
  };
  const sessionPath = `/api/v1/sessions/${sessionId}`;

  const join = async (displayName: string): Promise<{ token: string; participantId: string }> => {
    const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
      body: { roomCode: session.roomCode.value, displayName },
    }));
    return { token: joined.body.participantToken, participantId: joined.body.participantId };
  };
  const alice = await join("Alice");
  const bob = await join("Bob");

  /** Moves the stored session forward, phase by phase, to `phase`. */
  const moveTo = async (phase: PhaseIdentifier) => {
    const stored = await sessionRepo.findById(SessionId.from(sessionId));
    const from = PHASE_ORDER.indexOf(stored!.currentPhase);
    for (const next of PHASE_ORDER.slice(from + 1, PHASE_ORDER.indexOf(phase) + 1)) {
      stored!.transitionTo(next, START);
    }
    await sessionRepo.update(stored!);
  };

  const leave = async (token: string) =>
    invoke(handlers.leave, makeEvent("POST", `${sessionPath}/leave`, {
      pathParameters: { sessionId },
      token,
    }));

  const getState = async (token: string) =>
    invoke(handlers.get, makeEvent("GET", sessionPath, {
      pathParameters: { sessionId },
      token,
    }));

  const submitChain = async (token: string, path = CHAIN_PATH) =>
    invoke(handlers.submitChain, makeEvent("POST", `${sessionPath}/rounds/1/chains`, {
      body: { path, narrativeExplanation: "These concepts connect because..." },
      pathParameters: { sessionId, roundNumber: "1" },
      token,
    }));

  const adjudicate = async (token: string, chainId: string, action: string) =>
    invoke(handlers.adjudicate, makeEvent("POST", `${sessionPath}/rounds/1/chains/${chainId}/adjudicate`, {
      body: action.startsWith("instructor-")
        ? { action, feedback: "Sound reasoning.", qualityScore: 8 }
        : { action },
      pathParameters: { sessionId, roundNumber: "1", chainId },
      token,
    }));

  const listChains = async (token: string) =>
    invoke(handlers.listChains, makeEvent("GET", `${sessionPath}/rounds/1/chains`, {
      pathParameters: { sessionId, roundNumber: "1" },
      token,
    }));

  const standings = async (token: string) =>
    invoke(handlers.standings, makeEvent("GET", `${sessionPath}/rounds/1/standings`, {
      pathParameters: { sessionId, roundNumber: "1" },
      token,
    }));

  const submitPretest = async (token: string) =>
    invoke(handlers.assessment, makeEvent("POST", `${sessionPath}/assessments/pretest`, {
      body: {
        answers: Object.fromEntries(
          DIABE_TEACH_PACK.assessmentInstrument!.questions.map(q => [q.id, "I_DONT_KNOW"]),
        ),
      },
      pathParameters: { sessionId, stage: "pretest" },
      token,
    }));

  const submitSurvey = async (token: string) =>
    invoke(handlers.survey, makeEvent("POST", `${sessionPath}/survey`, {
      body: {
        responses: Object.fromEntries(
          DIABE_TEACH_PACK.perceptionSurvey!.items.map(item => [item.id, 4]),
        ),
      },
      pathParameters: { sessionId },
      token,
    }));

  return {
    sessionRepo,
    sessionId,
    instructorToken,
    alice,
    bob,
    moveTo,
    leave,
    getState,
    submitChain,
    adjudicate,
    listChains,
    standings,
    submitPretest,
    submitSurvey,
  };
}

function expectHasLeft(response: { statusCode: number; body: { code: string } }) {
  expect(response.statusCode).toBe(403);
  expect(response.body.code).toBe("PARTICIPANT_HAS_LEFT");
}

describe("a learner leaves the session (POST /sessions/{sessionId}/leave)", () => {
  it("records leftAt on the roster and drops participantCount by one", async () => {
    const s = await classroomWithTwoLearners();

    const left = await s.leave(s.alice.token);

    expect(left.statusCode).toBe(200);
    expect(left.body.state.participantCount).toBe(1);
    expect(left.body.state.participants).toEqual([
      expect.objectContaining({ participantId: s.alice.participantId, displayName: "Alice", leftAt: LEFT_AT }),
      expect.objectContaining({ participantId: s.bob.participantId, displayName: "Bob", leftAt: null }),
    ]);
    const teacherView = await s.getState(s.instructorToken);
    expect(teacherView.body.state.participantCount).toBe(1);
    expect(teacherView.body.state.participants[0].leftAt).toBe(LEFT_AT);
  });

  it("treats leaving twice as a no-op 200 that keeps the first leftAt", async () => {
    const s = await classroomWithTwoLearners();
    expect((await s.leave(s.alice.token)).statusCode).toBe(200);

    const again = await s.leave(s.alice.token);

    expect(again.statusCode).toBe(200);
    expect(again.body.state.participantCount).toBe(1);
    expect(again.body.state.participants[0].leftAt).toBe(LEFT_AT);
  });

  it("forbids an instructor token with 403 FORBIDDEN_ROLE", async () => {
    const s = await classroomWithTwoLearners();

    const forbidden = await s.leave(s.instructorToken);

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN_ROLE");
    expect((await s.getState(s.instructorToken)).body.state.participantCount).toBe(2);
  });

  it("refuses a missing token with 401", async () => {
    const s = await classroomWithTwoLearners();

    const response = await invoke(
      createLeaveSessionHandler({
        sessionRepo: s.sessionRepo,
        tokenVerifier: new FakeCapabilityTokenAdapter(),
      }),
      makeEvent("POST", `/api/v1/sessions/${s.sessionId}/leave`, {
        pathParameters: { sessionId: s.sessionId },
      }),
    );

    expect(response.statusCode).toBe(401);
  });

  it("refuses the pretest of a learner who left with 403 PARTICIPANT_HAS_LEFT", async () => {
    const s = await classroomWithTwoLearners();
    await s.leave(s.alice.token);

    expectHasLeft(await s.submitPretest(s.alice.token));
    expect((await s.submitPretest(s.bob.token)).statusCode).toBe(201);
  });

  it("refuses chain submission and peer votes of a learner who left", async () => {
    const s = await classroomWithTwoLearners();
    await s.moveTo("round-1:chain-mapping");
    const bobChain = await s.submitChain(s.bob.token);
    expect(bobChain.statusCode).toBe(201);
    await s.leave(s.alice.token);

    expectHasLeft(await s.submitChain(s.alice.token));

    await s.moveTo("round-1:peer-adjudication");
    expectHasLeft(await s.adjudicate(s.alice.token, bobChain.body.chain.chainId, "peer-approve"));
    expectHasLeft(await s.adjudicate(s.alice.token, bobChain.body.chain.chainId, "peer-challenge"));
    const stored = await s.sessionRepo.findById(SessionId.from(s.sessionId));
    expect(stored!.getChain(bobChain.body.chain.chainId)!.peerVotes).toEqual([]);
  });

  it("refuses the survey of a learner who left with 403 PARTICIPANT_HAS_LEFT", async () => {
    const s = await classroomWithTwoLearners();
    await s.moveTo("feedback-survey");
    await s.leave(s.alice.token);

    expectHasLeft(await s.submitSurvey(s.alice.token));
    expect((await s.submitSurvey(s.bob.token)).statusCode).toBe(201);
  });

  it("keeps the chains, votes and standings of a learner who left, and their reads still work", async () => {
    const s = await classroomWithTwoLearners();
    await s.moveTo("round-1:chain-mapping");
    const aliceChain = await s.submitChain(s.alice.token);
    const bobChain = await s.submitChain(s.bob.token, OTHER_CHAIN_PATH);
    expect(aliceChain.statusCode).toBe(201);
    expect(bobChain.statusCode).toBe(201);
    await s.moveTo("round-1:peer-adjudication");
    expect((await s.adjudicate(s.alice.token, bobChain.body.chain.chainId, "peer-approve")).statusCode).toBe(200);

    expect((await s.leave(s.alice.token)).statusCode).toBe(200);

    // Classmates may still vote on the chain of a learner who left.
    expect((await s.adjudicate(s.bob.token, aliceChain.body.chain.chainId, "peer-approve")).statusCode).toBe(200);
    expect((await s.adjudicate(s.instructorToken, aliceChain.body.chain.chainId, "instructor-approve")).statusCode).toBe(200);

    const chains = await s.listChains(s.alice.token);
    expect(chains.statusCode).toBe(200);
    expect(chains.body.chains.map((c: { chainId: string }) => c.chainId)).toContain(aliceChain.body.chain.chainId);
    const bobsChain = chains.body.chains.find((c: { chainId: string }) => c.chainId === bobChain.body.chain.chainId);
    expect(bobsChain.peerVotes).toEqual([
      expect.objectContaining({ voterParticipantId: s.alice.participantId, decision: "approve" }),
    ]);

    const standings = await s.standings(s.alice.token);
    expect(standings.statusCode).toBe(200);
    expect(standings.body.standings).toEqual([
      expect.objectContaining({ participantId: s.alice.participantId, displayName: "Alice" }),
    ]);

    const state = await s.getState(s.alice.token);
    expect(state.statusCode).toBe(200);
    expect(state.body.state.participants[0].leftAt).toBe(LEFT_AT);
  });
});
