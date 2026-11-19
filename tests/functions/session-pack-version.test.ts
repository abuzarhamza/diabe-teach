import type { APIGatewayProxyEvent } from "aws-lambda";
import type { PosttestSubmissionResult } from "../../src/application/ports/submit-assessment.port.js";
import type { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { describe, expect, it } from "vitest";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { CurriculumPack as CurriculumPackEntity } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

const PACK_ID = "pinning-pack";
const API_KEY = "test-api-key";

interface BoardCellView {
  readonly card: { readonly id: string; readonly displayLabel: string };
}

/** The register-pack request body for a version of the test pack, built from Diabe-teach's content. */
function packBody(pack: CurriculumPack, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PACK_ID,
    title: "Pinning pack",
    version: "1.0.0",
    description: pack.description,
    boardConfig: pack.boardConfig,
    domains: pack.domains,
    cards: pack.cards,
    adjudicationRubric: pack.adjudicationRubric,
    assessmentInstrument: pack.assessmentInstrument,
    perceptionSurvey: pack.perceptionSurvey,
    ...overrides,
  };
}

/** v1: Diabe-teach's cards, assessment instrument and survey under another pack id. */
const V1 = CurriculumPackEntity.create({
  ...(packBody(DIABE_TEACH_PACK) as unknown as Parameters<typeof CurriculumPackEntity.create>[0]),
  isSystemPack: false,
  isArchived: false,
  createdBy: null,
  authorName: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  archivedAt: null,
});

/** v2: the same cards relabelled, every answer key moved one option on, and new survey items. */
function version2Body(): Record<string, unknown> {
  return packBody(V1, {
    version: "2.0.0",
    cards: V1.cards.map(card => ({ ...card, displayLabel: `v2 ${card.displayLabel}` })),
    assessmentInstrument: {
      questions: V1.assessmentInstrument!.questions.map(question => ({
        ...question,
        correctIndex: (question.correctIndex + 1) % 4,
      })),
    },
    perceptionSurvey: {
      items: V1.perceptionSurvey!.items.map(item => ({ ...item, id: `v2-${item.id}` })),
    },
  });
}

function makeEvent(
  method: string,
  path: string,
  options: { body?: object; pathParameters?: Record<string, string>; token?: string } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
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
 * Starts a classroom session on v1 of the pack with one learner, then
 * registers v2 of the same pack through the register-pack handler.
 */
async function sessionStartedOnV1ThenV2Registered() {
  const packRepo = new InMemoryCurriculumPackRepository([V1]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const tokens = new FakeCapabilityTokenAdapter();
  const deps = {
    packRepo,
    sessionRepo,
    tokenVerifier: tokens,
    tokenSigner: tokens,
    apiKey: API_KEY,
    requireApiKey: true,
  };
  const handlers = {
    create: createCreateSessionHandler(deps),
    join: createJoinSessionHandler(deps),
    get: createGetSessionHandler(deps),
    transition: createTransitionPhaseHandler(deps),
    assessment: createSubmitAssessmentHandler(deps),
    survey: createSubmitSurveyHandler(deps),
    register: createRegisterPackHandler(deps),
  };

  const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
    body: {
      packId: PACK_ID,
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      seed: "pinned",
    },
  }));
  expect(created.statusCode).toBe(201);
  const { sessionId, roomCode, instructorToken } = created.body as {
    sessionId: string;
    roomCode: string;
    instructorToken: string;
  };
  const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
    body: { roomCode, displayName: "Alice" },
  }));
  expect(joined.statusCode).toBe(200);
  const participantToken = joined.body.participantToken as string;

  const registered = await invoke(handlers.register, makeEvent("POST", "/api/v1/packs", {
    body: version2Body(),
    token: instructorToken,
  }));
  expect(registered.statusCode).toBe(201);
  expect((await packRepo.findById(V1.id))?.version).toBe("2.0.0");

  const advanceTo = async (phase: string) => {
    for (let step = 0; step < 12; step++) {
      const response = await invoke(handlers.transition, makeEvent("POST", `/api/v1/sessions/${sessionId}/phase`, {
        body: { action: "advance" },
        pathParameters: { sessionId },
        token: instructorToken,
      }));
      expect(response.statusCode).toBe(200);
      if (response.body.state.currentPhase === phase) {
        return response.body.state as { activeBoard: { cells: BoardCellView[][] } | null };
      }
    }
    throw new Error(`Never reached phase '${phase}'.`);
  };

  const submitAssessment = async (stage: "pretest" | "posttest", answers: Record<string, unknown>) =>
    invoke(handlers.assessment, makeEvent("POST", `/api/v1/sessions/${sessionId}/assessments/${stage}`, {
      body: { answers },
      pathParameters: { sessionId, stage },
      token: participantToken,
    }));

  return {
    handlers,
    created: created.body,
    sessionId,
    instructorToken,
    participantToken,
    advanceTo,
    submitAssessment,
  };
}

/** Every v1 question answered with v1's correct option. */
function v1CorrectAnswers(): Record<string, number> {
  return Object.fromEntries(V1.assessmentInstrument!.questions.map(q => [q.id, q.correctIndex]));
}

function allIDontKnow(): Record<string, string> {
  return Object.fromEntries(V1.assessmentInstrument!.questions.map(q => [q.id, "I_DONT_KNOW"]));
}

describe("a Game Session keeps the Pack Version it started with", () => {
  it("records the pack's latest version at creation and reports it in the session state", async () => {
    const session = await sessionStartedOnV1ThenV2Registered();

    const state = await invoke(session.handlers.get, makeEvent("GET", `/api/v1/sessions/${session.sessionId}`, {
      pathParameters: { sessionId: session.sessionId },
      token: session.instructorToken,
    }));

    expect(session.created.state.packVersion).toBe("1.0.0");
    expect(state.body.state.packVersion).toBe("1.0.0");
  });

  it("deals the round board from v1's cards after v2 is registered", async () => {
    const session = await sessionStartedOnV1ThenV2Registered();

    const round1 = await session.advanceTo("round-1:chain-mapping");

    const cells = round1.activeBoard!.cells.flat();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.card).toEqual(V1.getCardById(cell.card.id));
      expect(cell.card.displayLabel.startsWith("v2 ")).toBe(false);
    }
  });

  it("marks the Pretest and Posttest against v1's assessment instrument, not v2's", async () => {
    const session = await sessionStartedOnV1ThenV2Registered();
    expect((await session.submitAssessment("pretest", allIDontKnow())).statusCode).toBe(201);
    await session.advanceTo("posttest");

    const posttest = await session.submitAssessment("posttest", v1CorrectAnswers());

    expect(posttest.statusCode).toBe(201);
    const result = posttest.body as PosttestSubmissionResult;
    const total = V1.assessmentInstrument!.questions.length;
    expect(result.report.posttest?.correctCount).toBe(total);
    expect(result.answerKeyReview.map(item => item.correctIndex))
      .toEqual(V1.assessmentInstrument!.questions.map(q => q.correctIndex));
  });

  it("records the perception survey against v1's survey items, not v2's", async () => {
    const session = await sessionStartedOnV1ThenV2Registered();
    await session.advanceTo("feedback-survey");
    const v1Responses = Object.fromEntries(V1.perceptionSurvey!.items.map(item => [item.id, 4]));

    const survey = await invoke(session.handlers.survey, makeEvent("POST", `/api/v1/sessions/${session.sessionId}/survey`, {
      body: { responses: v1Responses },
      pathParameters: { sessionId: session.sessionId },
      token: session.participantToken,
    }));

    expect(survey.statusCode).toBe(201);
    expect(survey.body.recordedItemCount).toBe(V1.perceptionSurvey!.items.length);
  });

  it("reads the latest version for a session stored before versions were pinned", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([V1]);
    const legacy = GameSession.rehydrate({
      packId: PACK_ID,
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      currentPhase: "feedback-survey",
    });
    const participant = legacy.addParticipant("Bob");
    const sessionRepo = new InMemoryGameSessionRepository([legacy]);
    const tokens = new FakeCapabilityTokenAdapter();
    const register = createRegisterPackHandler({
      packRepo,
      tokenVerifier: tokens,
      apiKey: API_KEY,
      requireApiKey: true,
    });
    const instructorToken = await tokens.signToken({ role: "instructor", sessionId: legacy.sessionId.value });
    expect((await invoke(register, makeEvent("POST", "/api/v1/packs", {
      body: version2Body(),
      token: instructorToken,
    }))).statusCode).toBe(201);
    const survey = createSubmitSurveyHandler({
      packRepo,
      sessionRepo,
      tokenVerifier: tokens,
      apiKey: API_KEY,
      requireApiKey: true,
    });
    const token = await tokens.signToken({
      role: "participant",
      sessionId: legacy.sessionId.value,
      participantId: participant.participantId,
    });
    const v2Responses = Object.fromEntries(V1.perceptionSurvey!.items.map(item => [`v2-${item.id}`, 4]));

    const response = await invoke(survey, makeEvent("POST", `/api/v1/sessions/${legacy.sessionId.value}/survey`, {
      body: { responses: v2Responses },
      pathParameters: { sessionId: legacy.sessionId.value },
      token,
    }));

    expect(legacy.packVersion).toBeNull();
    expect(response.statusCode).toBe(201);
    expect(response.body.recordedItemCount).toBe(V1.perceptionSurvey!.items.length);
  });
});
