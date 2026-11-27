import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import Ajv2020 from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createGetCurrentAccountHandler } from "../../netlify/functions/accounts/get-current-account.js";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { createGetPackByIdHandler } from "../../netlify/functions/packs/get-pack-by-id.js";
import { createListPacksHandler } from "../../netlify/functions/packs/list-packs.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createUnarchivePackHandler } from "../../netlify/functions/packs/unarchive-pack.js";
import { createValidatePackHandler } from "../../netlify/functions/packs/validate-pack.js";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createEndSessionHandler } from "../../netlify/functions/sessions/end-session.js";
import { createExtendPhaseHandler } from "../../netlify/functions/sessions/extend-phase.js";
import { createGetSessionAnalyticsHandler } from "../../netlify/functions/sessions/get-session-analytics.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createGetStandingsHandler } from "../../netlify/functions/sessions/get-standings.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createLeaveSessionHandler } from "../../netlify/functions/sessions/leave-session.js";
import { createListRoundChainsHandler } from "../../netlify/functions/sessions/list-round-chains.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { OPENAPI_PATH } from "../../scripts/generate-request-schemas.js";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { CryptoBoardSeedGenerator } from "../../src/adapters/outbound/crypto-board-seed-generator.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { SeedrandomSeededRandom } from "../../src/adapters/outbound/seedrandom-seeded-random.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

type LambdaHandler = (event: APIGatewayProxyEvent, context: LambdaContext) => Promise<APIGatewayProxyResult>;

const OPENAPI_ONLY_KEYWORDS = new Set(["example", "xml", "externalDocs"]);

function toAjvSchema(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(item => toAjvSchema(item));
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (OPENAPI_ONLY_KEYWORDS.has(key)) {
      continue;
    }
    if (key === "discriminator" && value !== null && typeof value === "object") {
      const { mapping: _mapping, ...discriminator } = value as Record<string, unknown>;
      result[key] = discriminator;
      continue;
    }
    result[key] = toAjvSchema(value);
  }
  return result;
}

interface OperationResponseSchemas {
  readonly operationId: string;
  readonly responses: Record<string, unknown>;
}

function samplePack(id = "contract-test-pack"): Record<string, unknown> {
  return {
    id,
    title: "Contract Test Pack",
    version: "1.0.0",
    description: "A 3x3 pack for OpenAPI response schema contract testing.",
    authorName: "Contract Tester",
    boardConfig: {
      rows: 3,
      cols: 3,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      { id: "domain-1", label: "Domain 1", description: "First domain" },
    ],
    cards: Array.from({ length: 9 }, (_, index) => ({
      id: `card-${index + 1}`,
      verbatimLabel: `Card ${index + 1}`,
      displayLabel: `Card ${index + 1}`,
      aliases: [],
      domainId: "domain-1",
      summary: `Card number ${index + 1}`,
    })),
    adjudicationRubric: {
      evaluatorPersona: "Test Evaluator",
      subjectDomain: "Testing",
      chainContinuityCriteria: ["Criterion 1"],
      calibrationExamples: [],
    },
    assessmentInstrument: null,
    perceptionSurvey: null,
  };
}

describe("openAPI response schema contract suite (api-testing-suite ticket 02)", () => {
  const ajv = new Ajv2020({
    strict: false,
    discriminator: true,
    allErrors: true,
    validateFormats: false,
  });

  const schemasByOperation = new Map<string, OperationResponseSchemas>();

  beforeAll(async () => {
    const rawDoc = parseYaml(readFileSync(OPENAPI_PATH, "utf8")) as Record<string, unknown>;
    const dereferenced = await $RefParser.dereference(rawDoc) as {
      paths: Record<string, Record<string, {
        "operationId"?: string;
        "x-implemented"?: boolean;
        "responses"?: Record<string, {
          content?: Record<string, { schema?: unknown }>;
        }>;
      }>>;
    };

    for (const methods of Object.values(dereferenced.paths)) {
      for (const operation of Object.values(methods)) {
        if (!operation?.operationId || operation["x-implemented"] === false) {
          continue;
        }
        const responses: Record<string, unknown> = {};
        for (const [status, responseDef] of Object.entries(operation.responses ?? {})) {
          const schema = responseDef.content?.["application/json"]?.schema;
          if (schema) {
            responses[status] = toAjvSchema(schema);
          }
        }
        schemasByOperation.set(operation.operationId, {
          operationId: operation.operationId,
          responses,
        });
      }
    }
  });

  function assertResponseMatchesOpenApi(operationId: string, status: number, body: unknown): void {
    const op = schemasByOperation.get(operationId);
    expect(op, `Missing operationId ${operationId} in openapi.yaml`).toBeDefined();
    const schema = op!.responses[String(status)];
    expect(schema, `Missing ${status} response schema on ${operationId} in openapi.yaml`).toBeDefined();
    const validate = ajv.compile(schema as object);
    const valid = validate(body);
    expect(valid, `${operationId} HTTP ${status} response schema mismatch: ${JSON.stringify(validate.errors)}\nBody: ${JSON.stringify(body)}`).toBe(true);
  }

  it("compiles all 23 implemented OpenAPI operation response schemas cleanly in Ajv 2020-12", () => {
    expect(schemasByOperation.size).toBe(23);
    for (const [operationId, op] of schemasByOperation.entries()) {
      expect(Object.keys(op.responses).length, operationId).toBeGreaterThan(0);
      for (const [status, schema] of Object.entries(op.responses)) {
        expect(() => ajv.compile(schema as object), `${operationId} ${status}`).not.toThrow();
      }
    }
  });

  it("validates 2xx and 4xx responses across all 20 implemented /api/v1/* operations against docs/api/openapi.yaml", async () => {
    const clock = new FakeClock(new Date("2026-11-23T12:00:00.000Z"));
    const accountTokens = new HmacAccountTokenAdapter(randomBytes(32).toString("hex"), clock);
    const capabilityTokens = new HmacCapabilityTokenAdapter(randomBytes(32).toString("hex"));
    const accountRepo = new InMemoryInstructorAccountRepository();
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const sessionRepo = new InMemoryGameSessionRepository();
    let seq = 0;

    const deps = {
      accountRepo,
      packRepo,
      sessionRepo,
      passwordHasher: new Argon2PasswordHasher(),
      accountTokenSigner: accountTokens,
      accountTokenVerifier: accountTokens,
      tokenSigner: capabilityTokens,
      tokenVerifier: capabilityTokens,
      idGenerator: {
        generate: () => `acc-${++seq}`,
      },
      clock,
      seededRandom: new SeedrandomSeededRandom(),
      seedGenerator: new CryptoBoardSeedGenerator(),
      apiKey: undefined,
      requireApiKey: false,
    };

    const wrap = (handler: unknown, path: string) =>
      wrapLambdaHandler(handler as LambdaHandler, { path });

    let reqId = 0;
    const invoke = async (
      route: ReturnType<typeof wrap>,
      method: string,
      url: string,
      options: { body?: unknown; token?: string } = {},
    ) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (options.token) {
        headers.authorization = `Bearer ${options.token}`;
      }
      const res = await route(
        new Request(`http://localhost:8888${url}`, {
          method,
          headers,
          body: options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        }),
        { params: {}, requestId: `contract-req-${++reqId}`, ip: "127.0.0.1" } as unknown as Context,
      );
      const text = await res.text();
      return {
        status: res.status,
        body: text
          ? JSON.parse(text)
          : {},
      };
    };

    // 1. signUpInstructor (201 & 409)
    const signUpRoute = wrap(createSignUpHandler(deps), "/api/v1/accounts/sign-up");
    const signUp201 = await invoke(signUpRoute, "POST", "/api/v1/accounts/sign-up", {
      body: { email: "rahman.s@aku.edu", password: "correct horse battery" },
    });
    expect(signUp201.status).toBe(201);
    assertResponseMatchesOpenApi("signUpInstructor", 201, signUp201.body);
    const accountToken = signUp201.body.accountToken as string;

    const signUp409 = await invoke(signUpRoute, "POST", "/api/v1/accounts/sign-up", {
      body: { email: "rahman.s@aku.edu", password: "correct horse battery" },
    });
    expect(signUp409.status).toBe(409);
    assertResponseMatchesOpenApi("signUpInstructor", 409, signUp409.body);

    // 2. signInInstructor (200 & 401)
    const signInRoute = wrap(createSignInHandler(deps), "/api/v1/accounts/sign-in");
    const signIn200 = await invoke(signInRoute, "POST", "/api/v1/accounts/sign-in", {
      body: { email: "rahman.s@aku.edu", password: "correct horse battery" },
    });
    expect(signIn200.status).toBe(200);
    assertResponseMatchesOpenApi("signInInstructor", 200, signIn200.body);

    const signIn401 = await invoke(signInRoute, "POST", "/api/v1/accounts/sign-in", {
      body: { email: "rahman.s@aku.edu", password: "wrong password" },
    });
    expect(signIn401.status).toBe(401);
    assertResponseMatchesOpenApi("signInInstructor", 401, signIn401.body);

    // 3. getCurrentInstructorAccount (200 & 401)
    const meRoute = wrap(createGetCurrentAccountHandler(deps), "/api/v1/accounts/me");
    const me200 = await invoke(meRoute, "GET", "/api/v1/accounts/me", { token: accountToken });
    expect(me200.status).toBe(200);
    assertResponseMatchesOpenApi("getCurrentInstructorAccount", 200, me200.body);

    const me401 = await invoke(meRoute, "GET", "/api/v1/accounts/me");
    expect(me401.status).toBe(401);
    assertResponseMatchesOpenApi("getCurrentInstructorAccount", 401, me401.body);

    // 4. validateCurriculumPack (200)
    const validatePackRoute = wrap(createValidatePackHandler(deps), "/api/v1/packs/validate");
    const validate200 = await invoke(validatePackRoute, "POST", "/api/v1/packs/validate", {
      body: samplePack(),
      token: accountToken,
    });
    expect(validate200.status).toBe(200);
    assertResponseMatchesOpenApi("validateCurriculumPack", 200, validate200.body);

    // 5. registerCurriculumPack (201 & 409)
    const registerPackRoute = wrap(createRegisterPackHandler(deps), "/api/v1/packs");
    const register201 = await invoke(registerPackRoute, "POST", "/api/v1/packs", {
      body: samplePack(),
      token: accountToken,
    });
    expect(register201.status).toBe(201);
    assertResponseMatchesOpenApi("registerCurriculumPack", 201, register201.body);

    const register409 = await invoke(registerPackRoute, "POST", "/api/v1/packs", {
      body: samplePack(),
      token: accountToken,
    });
    expect(register409.status).toBe(409);
    assertResponseMatchesOpenApi("registerCurriculumPack", 409, register409.body);

    // 6. listCurriculumPacks (200)
    const listPacksRoute = wrap(createListPacksHandler(deps), "/api/v1/packs");
    const listPacks200 = await invoke(listPacksRoute, "GET", "/api/v1/packs");
    expect(listPacks200.status).toBe(200);
    assertResponseMatchesOpenApi("listCurriculumPacks", 200, listPacks200.body);

    // 7. getCurriculumPackById (200 & 404)
    const getPackRoute = wrap(createGetPackByIdHandler(deps), "/api/v1/packs/:packId");
    const getPack200 = await invoke(getPackRoute, "GET", "/api/v1/packs/diabe-teach");
    expect(getPack200.status).toBe(200);
    assertResponseMatchesOpenApi("getCurriculumPackById", 200, getPack200.body);

    const getPack404 = await invoke(getPackRoute, "GET", "/api/v1/packs/no-such-pack");
    expect(getPack404.status).toBe(404);
    assertResponseMatchesOpenApi("getCurriculumPackById", 404, getPack404.body);

    // 8. archiveCurriculumPack (200 & 403)
    const archiveRoute = wrap(createArchivePackHandler(deps), "/api/v1/packs/:packId/archive");
    const archive200 = await invoke(archiveRoute, "POST", "/api/v1/packs/contract-test-pack/archive", {
      token: accountToken,
    });
    expect(archive200.status).toBe(200);
    assertResponseMatchesOpenApi("archiveCurriculumPack", 200, archive200.body);

    const archive403 = await invoke(archiveRoute, "POST", "/api/v1/packs/diabe-teach/archive", {
      token: accountToken,
    });
    expect(archive403.status).toBe(403);
    assertResponseMatchesOpenApi("archiveCurriculumPack", 403, archive403.body);

    // 9. unarchiveCurriculumPack (200)
    const unarchiveRoute = wrap(createUnarchivePackHandler(deps), "/api/v1/packs/:packId/unarchive");
    const unarchive200 = await invoke(unarchiveRoute, "POST", "/api/v1/packs/contract-test-pack/unarchive", {
      token: accountToken,
    });
    expect(unarchive200.status).toBe(200);
    assertResponseMatchesOpenApi("unarchiveCurriculumPack", 200, unarchive200.body);

    // 10. createGameSession (201)
    const createSessionRoute = wrap(createCreateSessionHandler(deps), "/api/v1/sessions");
    const create201 = await invoke(createSessionRoute, "POST", "/api/v1/sessions", {
      body: { packId: "diabe-teach", mode: "classroom", adjudicationMode: "peer-instructor" },
      token: accountToken,
    });
    expect(create201.status).toBe(201);
    assertResponseMatchesOpenApi("createGameSession", 201, create201.body);
    const sessionId = create201.body.sessionId as string;
    const roomCode = create201.body.roomCode as string;
    const instructorToken = create201.body.instructorToken as string;

    // 11. joinGameSession (200)
    const joinRoute = wrap(createJoinSessionHandler(deps), "/api/v1/sessions/join");
    const joinAlice = await invoke(joinRoute, "POST", "/api/v1/sessions/join", {
      body: { roomCode, displayName: "Alice" },
    });
    expect(joinAlice.status).toBe(200);
    assertResponseMatchesOpenApi("joinGameSession", 200, joinAlice.body);
    const aliceToken = joinAlice.body.participantToken as string;

    const joinBob = await invoke(joinRoute, "POST", "/api/v1/sessions/join", {
      body: { roomCode, displayName: "Bob" },
    });
    expect(joinBob.status).toBe(200);
    const bobToken = joinBob.body.participantToken as string;

    // 12. getGameSessionState (200)
    const getSessionRoute = wrap(createGetSessionHandler(deps), "/api/v1/sessions/:sessionId");
    const getSession200 = await invoke(getSessionRoute, "GET", `/api/v1/sessions/${sessionId}`, {
      token: instructorToken,
    });
    expect(getSession200.status).toBe(200);
    assertResponseMatchesOpenApi("getGameSessionState", 200, getSession200.body);

    // 13. submitAssessmentAttempt — pretest (201)
    const assessmentRoute = wrap(createSubmitAssessmentHandler(deps), "/api/v1/sessions/:sessionId/assessments/:stage");
    const defaultAnswers = {
      "dm-mcq-01": 0,
      "dm-mcq-02": 1,
      "dm-mcq-03": 2,
      "dm-mcq-04": 3,
      "dm-mcq-05": "I_DONT_KNOW",
      "dm-mcq-06": 0,
      "dm-mcq-07": 1,
      "dm-mcq-08": 2,
      "dm-mcq-09": 3,
      "dm-mcq-10": "I_DONT_KNOW",
    };
    const pretest201 = await invoke(assessmentRoute, "POST", `/api/v1/sessions/${sessionId}/assessments/pretest`, {
      body: { answers: defaultAnswers },
      token: aliceToken,
    });
    expect(pretest201.status).toBe(201);
    assertResponseMatchesOpenApi("submitAssessmentAttempt", 201, pretest201.body);

    // 14. transitionSessionPhase (200) -> trial-orientation -> round-1:chain-mapping
    const transitionRoute = wrap(createTransitionPhaseHandler(deps), "/api/v1/sessions/:sessionId/phase");
    const trans1 = await invoke(transitionRoute, "POST", `/api/v1/sessions/${sessionId}/phase`, {
      body: { action: "advance" },
      token: instructorToken,
    });
    expect(trans1.status).toBe(200);
    assertResponseMatchesOpenApi("transitionSessionPhase", 200, trans1.body);

    const trans2 = await invoke(transitionRoute, "POST", `/api/v1/sessions/${sessionId}/phase`, {
      body: { action: "advance", seed: "contract-seed" },
      token: instructorToken,
    });
    expect(trans2.status).toBe(200);
    assertResponseMatchesOpenApi("transitionSessionPhase", 200, trans2.body);

    // 15. extendSessionPhase (200)
    const extendRoute = wrap(createExtendPhaseHandler(deps), "/api/v1/sessions/:sessionId/phase/extend");
    const extend200 = await invoke(extendRoute, "POST", `/api/v1/sessions/${sessionId}/phase/extend`, {
      body: { seconds: 60 },
      token: instructorToken,
    });
    expect(extend200.status).toBe(200);
    assertResponseMatchesOpenApi("extendSessionPhase", 200, extend200.body);

    // 16. submitConceptChain (201)
    const submitChainRoute = wrap(createSubmitChainHandler(deps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains");
    const chain201 = await invoke(submitChainRoute, "POST", `/api/v1/sessions/${sessionId}/rounds/1/chains`, {
      body: {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        narrativeExplanation: "Mechanistic causal link across four adjacent diabetes concepts.",
        stepRationales: ["Step 1", "Step 2", "Step 3"],
      },
      token: aliceToken,
    });
    expect(chain201.status).toBe(201);
    assertResponseMatchesOpenApi("submitConceptChain", 201, chain201.body);
    const chainId = chain201.body.chain.chainId as string;

    // 17. listRoundChains (200)
    const listChainsRoute = wrap(createListRoundChainsHandler(deps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains");
    const listChains200 = await invoke(listChainsRoute, "GET", `/api/v1/sessions/${sessionId}/rounds/1/chains`, {
      token: instructorToken,
    });
    expect(listChains200.status).toBe(200);
    assertResponseMatchesOpenApi("listRoundChains", 200, listChains200.body);

    // 18. adjudicateConceptChain (200)
    const adjudicateRoute = wrap(
      createAdjudicateChainHandler(deps),
      "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
    );
    const adj200 = await invoke(
      adjudicateRoute,
      "POST",
      `/api/v1/sessions/${sessionId}/rounds/1/chains/${chainId}/adjudicate`,
      {
        body: { action: "instructor-approve", qualityScore: 8, feedback: "Well justified chain." },
        token: instructorToken,
      },
    );
    expect(adj200.status).toBe(200);
    assertResponseMatchesOpenApi("adjudicateConceptChain", 200, adj200.body);

    // 19. getRoundStandings (200)
    const standingsRoute = wrap(createGetStandingsHandler(deps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/standings");
    const standings200 = await invoke(standingsRoute, "GET", `/api/v1/sessions/${sessionId}/rounds/1/standings`, {
      token: instructorToken,
    });
    expect(standings200.status).toBe(200);
    assertResponseMatchesOpenApi("getRoundStandings", 200, standings200.body);

    // Advance 6 times from round-1:chain-mapping to posttest
    for (let i = 0; i < 6; i++) {
      await invoke(transitionRoute, "POST", `/api/v1/sessions/${sessionId}/phase`, {
        body: { action: "advance" },
        token: instructorToken,
      });
    }

    // submitAssessmentAttempt — posttest (201)
    const posttest201 = await invoke(assessmentRoute, "POST", `/api/v1/sessions/${sessionId}/assessments/posttest`, {
      body: { answers: defaultAnswers },
      token: aliceToken,
    });
    expect(posttest201.status).toBe(201);
    assertResponseMatchesOpenApi("submitAssessmentAttempt", 201, posttest201.body);

    // 20. getSessionAnalytics — participant & instructor (200)
    const analyticsRoute = wrap(createGetSessionAnalyticsHandler(deps), "/api/v1/sessions/:sessionId/analytics");
    const analyticsLearner200 = await invoke(analyticsRoute, "GET", `/api/v1/sessions/${sessionId}/analytics`, {
      token: aliceToken,
    });
    expect(analyticsLearner200.status).toBe(200);
    assertResponseMatchesOpenApi("getSessionAnalytics", 200, analyticsLearner200.body);

    const analyticsInstructor200 = await invoke(analyticsRoute, "GET", `/api/v1/sessions/${sessionId}/analytics`, {
      token: instructorToken,
    });
    expect(analyticsInstructor200.status).toBe(200);
    assertResponseMatchesOpenApi("getSessionAnalytics", 200, analyticsInstructor200.body);

    // Advance to feedback-survey
    await invoke(transitionRoute, "POST", `/api/v1/sessions/${sessionId}/phase`, {
      body: { action: "advance" },
      token: instructorToken,
    });

    // 21. submitPerceptionSurvey (201)
    const surveyRoute = wrap(createSubmitSurveyHandler(deps), "/api/v1/sessions/:sessionId/survey");
    const survey201 = await invoke(surveyRoute, "POST", `/api/v1/sessions/${sessionId}/survey`, {
      body: {
        responses: {
          "survey-q1": 5,
          "survey-q2": 4,
          "survey-q3": 5,
          "survey-q4": 4,
          "survey-q5": 5,
          "survey-q6": 4,
          "survey-q7": 5,
          "survey-q8": 4,
          "survey-q9": 5,
        },
        comments: "Very helpful clinical reasoning exercise.",
      },
      token: aliceToken,
    });
    expect(survey201.status).toBe(201);
    assertResponseMatchesOpenApi("submitPerceptionSurvey", 201, survey201.body);

    // 22. leaveGameSession (200)
    const leaveRoute = wrap(createLeaveSessionHandler(deps), "/api/v1/sessions/:sessionId/leave");
    const leave200 = await invoke(leaveRoute, "POST", `/api/v1/sessions/${sessionId}/leave`, {
      token: bobToken,
    });
    expect(leave200.status).toBe(200);
    assertResponseMatchesOpenApi("leaveGameSession", 200, leave200.body);

    // 23. endGameSession (200)
    const endRoute = wrap(createEndSessionHandler(deps), "/api/v1/sessions/:sessionId/end");
    const end200 = await invoke(endRoute, "POST", `/api/v1/sessions/${sessionId}/end`, {
      token: instructorToken,
    });
    expect(end200.status).toBe(200);
    assertResponseMatchesOpenApi("endGameSession", 200, end200.body);
  });
});
