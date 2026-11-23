import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { RequestBodyOperationId } from "../../src/adapters/inbound/http/request-schemas.generated.js";
import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createValidatePackHandler } from "../../netlify/functions/packs/validate-pack.js";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createExtendPhaseHandler } from "../../netlify/functions/sessions/extend-phase.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { apiOperationIds, requestBodySchemas } from "../../src/adapters/inbound/http/request-schemas.generated.js";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

/**
 * api-hardening 06: a body that is valid JSON but breaks its route's request
 * schema (generated from docs/api/openapi.yaml) gets 400
 * INVALID_REQUEST_BODY naming the field, never a 500.
 */

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;
type Body = Record<string, unknown>;

const root = resolve(import.meta.dirname, "../..");
const SESSION_ID = "session-under-test";

/** Raw Ajv wording and internals that must never reach a client. */
const AJV_WORDING = [
  "must have required property",
  "must be equal to one of the allowed values",
  "must be equal to constant",
  "must NOT",
  "must match exactly one schema",
  "instancePath",
  "schemaPath",
  "missingProperty",
  "allowedValues",
  "#/",
  "tag \"action\"",
  "discriminator",
];

function expectSafe(rawBody: string): void {
  expect(rawBody).not.toMatch(/\bat \S+ \(/);
  expect(rawBody).not.toMatch(/\n\s+at /);
  expect(rawBody).not.toMatch(/\.(?:ts|js|mjs):\d+/);
  expect(rawBody).not.toMatch(/node_modules|\/Users\/|\/src\//);
  expect(rawBody).not.toMatch(/"stack"/);
  for (const phrase of AJV_WORDING) {
    expect(rawBody).not.toContain(phrase);
  }
}

function makeEvent(path: string, body: unknown, headers: Record<string, string>, pathParameters?: Record<string, string>): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined
      ? null
      : JSON.stringify(body),
    isBase64Encoded: false,
    pathParameters: pathParameters ?? null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

function createMinimalPack(): Body {
  return {
    id: "schema-test-pack",
    title: "Schema Test Pack",
    version: "1.0.0",
    description: "A pack for request schema tests.",
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

interface Route {
  readonly operationId: RequestBodyOperationId;
  readonly path: string;
  readonly pathParameters?: Record<string, string>;
  /** A body that satisfies the request schema. */
  readonly validBody: () => Body;
  /** Builds the handler and the Authorization header that passes its auth check. */
  readonly build: () => Promise<{ handler: Handler; authorization?: string }>;
  readonly needsToken: boolean;
}

async function capabilityRoute(role: "instructor" | "participant") {
  const tokens = new FakeCapabilityTokenAdapter();
  const token = await tokens.signToken(role === "instructor"
    ? { role, sessionId: SESSION_ID }
    : { role, sessionId: SESSION_ID, participantId: "p-1" });
  return { tokens, authorization: `Bearer ${token}` };
}

async function accountRoute() {
  const teachers = new SignedInTeachers();
  return { teachers, authorization: `Bearer ${await teachers.tokenFor()}` };
}

/** Every documented write route, keyed by the operationId it declares. */
const ROUTES: readonly Route[] = [
  {
    operationId: "signUpInstructor",
    path: "/api/v1/accounts/sign-up",
    needsToken: false,
    validBody: () => ({ email: "schema.test@example.edu", password: "long-enough-password" }),
    build: async () => ({
      handler: createSignUpHandler({
        accountRepo: new InMemoryInstructorAccountRepository(),
        passwordHasher: new Argon2PasswordHasher(),
        idGenerator: {
          generate: () => "account-1",
        },
        clock: new FakeClock(new Date("2026-11-19T08:00:00.000Z")),
        apiKey: undefined,
        requireApiKey: false,
      }) as unknown as Handler,
    }),
  },
  {
    operationId: "signInInstructor",
    path: "/api/v1/accounts/sign-in",
    needsToken: false,
    validBody: () => ({ email: "schema.test@example.edu", password: "long-enough-password" }),
    build: async () => ({
      handler: createSignInHandler({
        accountRepo: new InMemoryInstructorAccountRepository(),
        passwordHasher: new Argon2PasswordHasher(),
        clock: new FakeClock(new Date("2026-11-19T08:00:00.000Z")),
        apiKey: undefined,
        requireApiKey: false,
      }) as unknown as Handler,
    }),
  },
  {
    operationId: "registerCurriculumPack",
    path: "/api/v1/packs",
    needsToken: true,
    validBody: createMinimalPack,
    build: async () => {
      const { teachers, authorization } = await accountRoute();
      return {
        handler: createRegisterPackHandler({
          packRepo: new InMemoryCurriculumPackRepository([]),
          accountTokenVerifier: teachers.verifier,
          apiKey: undefined,
          requireApiKey: false,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "validateCurriculumPack",
    path: "/api/v1/packs/validate",
    needsToken: true,
    validBody: createMinimalPack,
    build: async () => {
      const { teachers, authorization } = await accountRoute();
      return {
        handler: createValidatePackHandler({ accountTokenVerifier: teachers.verifier, apiKey: undefined, requireApiKey: false }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "createGameSession",
    path: "/api/v1/sessions",
    needsToken: false,
    validBody: () => ({ packId: "diabe-teach", mode: "solo", adjudicationMode: "peer-instructor" }),
    build: async () => ({
      handler: createCreateSessionHandler({
        packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
        sessionRepo: new InMemoryGameSessionRepository(),
        tokenSigner: new FakeCapabilityTokenAdapter(),
        accountTokenVerifier: new SignedInTeachers().verifier,
      }) as unknown as Handler,
    }),
  },
  {
    operationId: "joinGameSession",
    path: "/api/v1/sessions/join",
    needsToken: false,
    validBody: () => ({ roomCode: "K7QX2M", displayName: "Amira" }),
    build: async () => ({
      handler: createJoinSessionHandler({
        sessionRepo: new InMemoryGameSessionRepository(),
        tokenSigner: new FakeCapabilityTokenAdapter(),
      }) as unknown as Handler,
    }),
  },
  {
    operationId: "transitionSessionPhase",
    path: `/api/v1/sessions/${SESSION_ID}/phase`,
    pathParameters: { sessionId: SESSION_ID },
    needsToken: true,
    validBody: () => ({ action: "advance" }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("instructor");
      return {
        handler: createTransitionPhaseHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          packRepo: new InMemoryCurriculumPackRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "extendSessionPhase",
    path: `/api/v1/sessions/${SESSION_ID}/phase/extend`,
    pathParameters: { sessionId: SESSION_ID },
    needsToken: true,
    validBody: () => ({ seconds: 60 }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("instructor");
      return {
        handler: createExtendPhaseHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "submitConceptChain",
    path: `/api/v1/sessions/${SESSION_ID}/rounds/1/chains`,
    pathParameters: { sessionId: SESSION_ID, roundNumber: "1" },
    needsToken: true,
    validBody: () => ({
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      narrativeExplanation: "Insulin moves GLUT4 to the membrane.",
      keywordIds: ["insulin", "glut4"],
      stepRationales: ["Insulin signalling translocates GLUT4."],
    }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("participant");
      return {
        handler: createSubmitChainHandler({
          packRepo: new InMemoryCurriculumPackRepository(),
          sessionRepo: new InMemoryGameSessionRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "adjudicateConceptChain",
    path: `/api/v1/sessions/${SESSION_ID}/rounds/1/chains/chain-1/adjudicate`,
    pathParameters: { sessionId: SESSION_ID, roundNumber: "1", chainId: "chain-1" },
    needsToken: true,
    validBody: () => ({ action: "instructor-approve", feedback: "Name the mechanism.", qualityScore: 7 }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("instructor");
      return {
        handler: createAdjudicateChainHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "submitAssessmentAttempt",
    path: `/api/v1/sessions/${SESSION_ID}/assessments/pretest`,
    pathParameters: { sessionId: SESSION_ID, stage: "pretest" },
    needsToken: true,
    validBody: () => ({
      answers: { q1: 2, q2: "I_DONT_KNOW" },
    }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("participant");
      return {
        handler: createSubmitAssessmentHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          packRepo: new InMemoryCurriculumPackRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
  {
    operationId: "submitPerceptionSurvey",
    path: `/api/v1/sessions/${SESSION_ID}/survey`,
    pathParameters: { sessionId: SESSION_ID },
    needsToken: true,
    validBody: () => ({
      responses: { "survey-q1": 4 },
      comments: "Fun.",
    }),
    build: async () => {
      const { tokens, authorization } = await capabilityRoute("participant");
      return {
        handler: createSubmitSurveyHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          packRepo: new InMemoryCurriculumPackRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization,
      };
    },
  },
];

function routeFor(operationId: RequestBodyOperationId): Route {
  const route = ROUTES.find(candidate => candidate.operationId === operationId);
  if (!route) {
    throw new Error(`No test route for ${operationId}`);
  }
  return route;
}

async function send(route: Route, body: unknown, options: { withToken?: boolean } = {}) {
  const { handler, authorization } = await route.build();
  const headers: Record<string, string> = options.withToken !== false && authorization
    ? { authorization }
    : {};
  const result = (await handler(makeEvent(route.path, body, headers, route.pathParameters), {} as never)) as APIGatewayProxyResult;
  if (result.statusCode >= 400) {
    expectSafe(result.body);
  }
  return {
    status: result.statusCode,
    body: JSON.parse(result.body) as Body,
  };
}

async function expectInvalidField(route: Route, body: unknown, field: string, reason?: string) {
  const res = await send(route, body);
  expect(res.status, JSON.stringify(res.body)).toBe(400);
  expect(res.body.code).toBe("INVALID_REQUEST_BODY");
  const details = res.body.details as { field: string; reason: string };
  expect(details.field).toBe(field);
  expect(typeof details.reason).toBe("string");
  if (reason !== undefined) {
    expect(details.reason).toBe(reason);
  }
  expect(res.body.message).toContain(field);
  return res;
}

type JsonSchema = Record<string, unknown> & {
  required?: string[];
  properties?: Record<string, JsonSchema>;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  type?: string | string[];
};

/** The top-level required fields and properties of a body, following `allOf` and the `oneOf` branch the body picks. */
function topLevelOf(schema: JsonSchema, body: Body): { required: string[]; properties: Record<string, JsonSchema> } {
  const parts: JsonSchema[] = [
    schema,
    ...(schema.allOf ?? []),
  ];
  if (schema.oneOf) {
    const branch = schema.oneOf.find((candidate) => {
      const action = candidate.properties?.action as { enum?: unknown[]; const?: unknown } | undefined;
      return action?.enum?.includes(body.action) || action?.const === body.action;
    });
    if (!branch) {
      throw new Error("The valid body matches no oneOf branch");
    }
    parts.push(branch);
  }
  return {
    required: parts.flatMap(part => part.required ?? []),
    properties: Object.assign({}, ...parts.map(part => part.properties ?? {})) as Record<string, JsonSchema>,
  };
}

/** A value of a type the property's schema does not allow. */
function wrongTypeFor(property: JsonSchema): unknown {
  const types = Array.isArray(property.type)
    ? property.type
    : [property.type];
  return types.includes("string")
    ? 12345
    : "not-the-right-type";
}

const schemaAjv = new Ajv2020({ strict: true, discriminator: true, validateFormats: false });

describe("request bodies are validated against the OpenAPI request schema (api-hardening 06)", () => {
  it("has a test route for every operation with a request body", () => {
    expect(ROUTES.map(route => route.operationId).sort()).toEqual(Object.keys(requestBodySchemas).sort());
  });

  describe.each(ROUTES)("$operationId", (route) => {
    const schema = requestBodySchemas[route.operationId].schema as unknown as JsonSchema;
    const { required, properties } = topLevelOf(schema, route.validBody());

    it("the test's valid body satisfies the schema", () => {
      const validate = schemaAjv.compile(schema);
      expect(validate(route.validBody()), JSON.stringify(validate.errors)).toBe(true);
    });

    it("never answers a valid body with INVALID_REQUEST_BODY naming a field", async () => {
      const res = await send(route, route.validBody());
      expect(res.status).not.toBe(500);
      if (res.status === 400) {
        expect(res.body.details).toBeUndefined();
      }
    });

    it.each(required.map(field => [field]))("removing required `%s` returns 400 naming it", async (field) => {
      const body = route.validBody();
      delete body[field];
      await expectInvalidField(route, body, field, "is required");
    });

    it.each(Object.keys(properties).map(field => [field]))("a wrongly typed `%s` returns 400 naming it", async (field) => {
      const body = {
        ...route.validBody(),
        [field]: wrongTypeFor(properties[field]!),
      };
      const res = await send(route, body);
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body.code).toBe("INVALID_REQUEST_BODY");
      expect((res.body.details as { field: string }).field.startsWith(field)).toBe(true);
    });
  });

  describe.each(ROUTES.filter(route => route.needsToken))("$operationId without a token", (route) => {
    it("returns 401, not 400, for a body that breaks the schema", async () => {
      const res = await send(route, { unexpected: 1 }, { withToken: false });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
    });
  });

  describe("named cases", () => {
    const join = routeFor("joinGameSession");
    const create = routeFor("createGameSession");
    const transition = routeFor("transitionSessionPhase");
    const adjudicate = routeFor("adjudicateConceptChain");
    const chain = routeFor("submitConceptChain");
    const survey = routeFor("submitPerceptionSurvey");
    const assessment = routeFor("submitAssessmentAttempt");
    const signUp = routeFor("signUpInstructor");

    it("join with no roomCode returns 400 naming roomCode", async () => {
      await expectInvalidField(join, { displayName: "Amira" }, "roomCode", "is required");
    });

    it("join with no body at all returns 400 naming roomCode", async () => {
      await expectInvalidField(join, undefined, "roomCode", "is required");
    });

    it("join with a non-string roomCode returns 400 naming roomCode", async () => {
      await expectInvalidField(join, { roomCode: 42 }, "roomCode", "must be a string");
    });

    it("create-session with an unknown mode returns 400 naming mode", async () => {
      await expectInvalidField(create, {
        ...create.validBody(),
        mode: "tournament",
      }, "mode", "must be one of: solo, classroom, study-rct");
    });

    it("create-session with an unknown adjudicationMode returns 400 naming adjudicationMode", async () => {
      await expectInvalidField(create, {
        ...create.validBody(),
        adjudicationMode: "robot",
      }, "adjudicationMode", "must be one of: ai, peer-instructor, hybrid");
    });

    it("create-session with a timer duration out of range names its path", async () => {
      await expectInvalidField(create, {
        ...create.validBody(),
        timerConfig: { pretestSec: 0 },
      }, "timerConfig.pretestSec", "must be at least 1");
    });

    it("transition with no action returns 400 naming action", async () => {
      await expectInvalidField(transition, {}, "action", "is required");
    });

    it("transition with an unknown action returns 400 naming action", async () => {
      await expectInvalidField(transition, { action: "rewind" }, "action", "must be one of: advance, jump");
    });

    it("adjudicate with no action returns 400 naming action", async () => {
      await expectInvalidField(adjudicate, {}, "action", "is required");
    });

    it("adjudicate with an unknown action returns 400 naming action", async () => {
      await expectInvalidField(
        adjudicate,
        { action: "instructor-final" },
        "action",
        "must be one of: peer-approve, peer-challenge, ai-evaluate, instructor-approve, instructor-reject",
      );
    });

    it("an instructor ruling with an empty feedback returns 400 naming feedback", async () => {
      await expectInvalidField(adjudicate, { action: "instructor-reject", feedback: "" }, "feedback", "must not be empty");
    });

    it("a chain of one cell returns 400 naming path", async () => {
      await expectInvalidField(chain, {
        ...chain.validBody(),
        path: [
          { row: 0, col: 0 },
        ],
      }, "path", "must have at least 2 items");
    });

    it("a chain cell with a negative row names its JSON path", async () => {
      await expectInvalidField(
        chain,
        {
          ...chain.validBody(),
          path: [
            { row: 0, col: 0 },
            { row: -1, col: 0 },
          ],
        },
        "path[1].row",
        "must be at least 0",
      );
    });

    it("an empty narrativeExplanation returns 400 naming it", async () => {
      await expectInvalidField(chain, {
        ...chain.validBody(),
        narrativeExplanation: "",
      }, "narrativeExplanation", "must not be empty");
    });

    it("stepRationales sent as objects return 400 naming the item", async () => {
      await expectInvalidField(
        chain,
        {
          ...chain.validBody(),
          stepRationales: [
            { rationale: "Insulin moves glucose" },
          ],
        },
        "stepRationales[0]",
        "must be a string",
      );
    });

    it("an unknown assessment answer lists every allowed answer", async () => {
      await expectInvalidField(assessment, {
        answers: { q1: 7 },
      }, "answers.q1", "must be one of: 0, 1, 2, 3, I_DONT_KNOW");
    });

    it("a Likert rating out of range names the item", async () => {
      await expectInvalidField(survey, {
        responses: { "survey-q1": 6 },
      }, "responses.survey-q1", "must be one of: 1, 2, 3, 4, 5");
    });

    it("sign-up still accepts a padded, mixed-case email (the domain trims and lower-cases it)", async () => {
      const res = await send(signUp, { email: "  Schema.Test@Example.EDU ", password: "long-enough-password" });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe("schema.test@example.edu");
    });

    it("sign-up still refuses an invalid email with 400 from the domain", async () => {
      const res = await send(signUp, { email: "not-an-email", password: "long-enough-password" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_REQUEST_BODY");
      expect((res.body.details as { field: string }).field).toBe("email");
    });

    it("a domain rule keeps its own code: a 2-cell chain shape passes the schema", async () => {
      // No session exists, so the request gets past the schema to the use case.
      const res = await send(chain, chain.validBody());
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SESSION_NOT_FOUND");
    });
  });
});

describe("every route declares its OpenAPI operationId to createApiHandler (api-hardening 06)", () => {
  const spec = parseYaml(readFileSync(resolve(root, "docs/api/openapi.yaml"), "utf8")) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };
  const specRoutes = new Map<string, { method: string; path: string }>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (operation?.operationId) {
        specRoutes.set(operation.operationId, {
          method: method.toUpperCase(),
          path: path.replace(/\{(\w+)\}/g, ":$1"),
        });
      }
    }
  }

  const functionsDir = resolve(root, "netlify/functions");
  const routeFiles = readdirSync(functionsDir)
    .filter(file => file.endsWith(".ts") && file !== "health.ts");

  it("finds the route files", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(19);
  });

  it.each(routeFiles.map(file => [
    basename(file, ".ts"),
    file,
  ]))("%s", (_name, file) => {
    const entry = readFileSync(resolve(functionsDir, file), "utf8");
    const path = /path:\s*"([^"]+)"/.exec(entry)?.[1];
    const method = /method:\s*"([^"]+)"/.exec(entry)?.[1];
    const implementation = /from "\.\/(\w+\/[\w-]+)\.js"/.exec(entry)?.[1];
    expect(implementation, "imports its implementation").toBeDefined();

    const source = readFileSync(resolve(functionsDir, `${implementation}.ts`), "utf8");
    const declared = /createApiHandler\(rawHandler, \{[\s\S]*?\}, "(\w+)"\)/.exec(source)?.[1];
    expect(declared, "passes an operationId to createApiHandler").toBeDefined();
    expect(apiOperationIds).toContain(declared);
    expect(specRoutes.get(declared!)).toEqual({ method, path });
  });
});
