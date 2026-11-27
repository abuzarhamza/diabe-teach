import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { createApiHandler } from "../../src/adapters/inbound/http/middy/api-handler.js";
import { MAX_REQUEST_BODY_BYTES } from "../../src/adapters/inbound/http/middy/request-size-limit.middleware.js";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { PinoLogger } from "../../src/adapters/outbound/pino-logger.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;

const SESSION_ID = "session-under-test";

/**
 * Fails if an error response leaks internals: stack frames, source paths,
 * a `stack` field, or the JSON parser's own message.
 */
function expectNoLeak(rawBody: string): void {
  expect(rawBody).not.toMatch(/\bat \S+ \(/);
  expect(rawBody).not.toMatch(/\n\s+at /);
  expect(rawBody).not.toMatch(/\.(?:ts|js|mjs):\d+/);
  expect(rawBody).not.toMatch(/node_modules|\/Users\/|\/src\//);
  expect(rawBody).not.toMatch(/"stack"/);
  expect(rawBody).not.toMatch(/Unexpected token|Unsupported Media Type|http-json-body-parser/);
}

async function call(handler: Handler, event: APIGatewayProxyEvent) {
  const result = (await handler(event, {} as never)) as APIGatewayProxyResult;
  if (result.statusCode >= 400) {
    expectNoLeak(result.body);
  }
  return {
    status: result.statusCode,
    body: JSON.parse(result.body) as Record<string, unknown>,
  };
}

function makeEvent(options: {
  path: string;
  rawBody: string | null;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
}): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: options.path,
    headers: options.headers ?? {},
    body: options.rawBody,
    isBase64Encoded: false,
    pathParameters: options.pathParameters ?? null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

interface Route {
  readonly name: string;
  readonly path: string;
  readonly pathParameters?: Record<string, string>;
  /** Builds the handler and the Authorization header that passes its auth check. */
  readonly build: () => Promise<{ handler: Handler; authorization?: string }>;
  readonly needsToken: boolean;
}

function makeChainMappingSession(): GameSession {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  session.transitionTo("trial-orientation", new Date());
  session.transitionTo("round-1:chain-mapping", new Date());
  return session;
}

const ROUTES: readonly Route[] = [
  {
    name: "register pack (POST /api/v1/packs)",
    path: "/api/v1/packs",
    needsToken: true,
    build: async () => {
      const teachers = new SignedInTeachers();
      const handler = createRegisterPackHandler({
        packRepo: new InMemoryCurriculumPackRepository([]),
        accountTokenVerifier: teachers.verifier,
        apiKey: undefined,
        requireApiKey: false,
      }) as unknown as Handler;
      return { handler, authorization: `Bearer ${await teachers.tokenFor()}` };
    },
  },
  {
    name: "sign up (POST /api/v1/accounts/sign-up)",
    path: "/api/v1/accounts/sign-up",
    needsToken: false,
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
    name: "create session (POST /api/v1/sessions)",
    path: "/api/v1/sessions",
    needsToken: false,
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
    name: "submit chain (POST /api/v1/sessions/{id}/rounds/{n}/chains)",
    path: `/api/v1/sessions/${SESSION_ID}/rounds/1/chains`,
    pathParameters: { sessionId: SESSION_ID, roundNumber: "1" },
    needsToken: true,
    build: async () => {
      const tokens = new FakeCapabilityTokenAdapter();
      const token = await tokens.signToken({ role: "participant", sessionId: SESSION_ID, participantId: "p-1" });
      return {
        handler: createSubmitChainHandler({
          packRepo: new InMemoryCurriculumPackRepository(),
          sessionRepo: new InMemoryGameSessionRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization: `Bearer ${token}`,
      };
    },
  },
  {
    name: "transition phase (POST /api/v1/sessions/{id}/phase)",
    path: `/api/v1/sessions/${SESSION_ID}/phase`,
    pathParameters: { sessionId: SESSION_ID },
    needsToken: true,
    build: async () => {
      const tokens = new FakeCapabilityTokenAdapter();
      const token = await tokens.signToken({ role: "instructor", sessionId: SESSION_ID });
      return {
        handler: createTransitionPhaseHandler({
          sessionRepo: new InMemoryGameSessionRepository(),
          packRepo: new InMemoryCurriculumPackRepository(),
          tokenVerifier: tokens,
        }) as unknown as Handler,
        authorization: `Bearer ${token}`,
      };
    },
  },
];

const BAD_BODIES: ReadonlyArray<readonly [string, string, Record<string, string>]> = [
  [
    "malformed JSON",
    "{\"packId\": ",
    { "content-type": "application/json" },
  ],
  ["a JSON body without a JSON content type", "{\"packId\":\"diabe-teach\"}", {}],
  [
    "a JSON body sent as form data (curl -d)",
    "{\"packId\":\"diabe-teach\"}",
    { "content-type": "application/x-www-form-urlencoded" },
  ],
  [
    "a JSON array",
    "[1, 2, 3]",
    { "content-type": "application/json" },
  ],
  [
    "a JSON string",
    "\"hello\"",
    { "content-type": "application/json" },
  ],
  [
    "a JSON null",
    "null",
    { "content-type": "application/json" },
  ],
  [
    "a __proto__ key",
    "{\"__proto__\": {\"admin\": true}}",
    { "content-type": "application/json" },
  ],
];

describe("a bad request body never returns a stack trace (api-hardening 01)", () => {
  describe.each(ROUTES)("$name", (route) => {
    it.each(BAD_BODIES)("returns 400 INVALID_REQUEST_BODY for %s", async (_label, rawBody, headers) => {
      const { handler, authorization } = await route.build();

      const res = await call(handler, makeEvent({
        path: route.path,
        rawBody,
        headers: {
          ...headers,
          ...(authorization
            ? { authorization }
            : {}),
        },
        pathParameters: route.pathParameters,
      }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_REQUEST_BODY");
      expect(typeof res.body.message).toBe("string");
      expect(res.body).not.toHaveProperty("stack");
    });
  });

  describe.each(ROUTES.filter(route => route.needsToken))("$name without a token", (route) => {
    it.each(BAD_BODIES)("returns 401, not 400, for %s", async (_label, rawBody, headers) => {
      const { handler } = await route.build();

      const res = await call(handler, makeEvent({
        path: route.path,
        rawBody,
        headers,
        pathParameters: route.pathParameters,
      }));

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
    });
  });
});

/** A JSON object body of exactly `bytes` bytes, padded with `fill` (one or more bytes per character). */
function jsonBodyOfBytes(bytes: number, fill = "a"): string {
  const shell = "{\"padding\":\"\"}";
  const fillBytes = Buffer.byteLength(fill, "utf8");
  const room = bytes - shell.length;
  const padding = fill.repeat(Math.floor(room / fillBytes)) + "a".repeat(room % fillBytes);
  const body = `{"padding":"${padding}"}`;
  expect(Buffer.byteLength(body, "utf8")).toBe(bytes);
  return body;
}

describe("an oversized request body is refused with 413 (api-completion 11)", () => {
  const JSON_HEADERS = { "content-type": "application/json" };

  function echoHandler(): Handler {
    return createApiHandler(async () => ({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }), {}, "getGameSessionState") as unknown as Handler;
  }

  it("accepts a body exactly at the 256 KB limit", async () => {
    expect(MAX_REQUEST_BODY_BYTES).toBe(256 * 1024);

    const res = await call(echoHandler(), makeEvent({
      path: "/api/v1/anything",
      rawBody: jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES),
      headers: JSON_HEADERS,
    }));

    expect(res.status).toBe(200);
  });

  it("accepts a body just under the limit", async () => {
    const res = await call(echoHandler(), makeEvent({
      path: "/api/v1/anything",
      rawBody: jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES - 1),
      headers: JSON_HEADERS,
    }));

    expect(res.status).toBe(200);
  });

  it("counts bytes, not characters", async () => {
    const rawBody = jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES + 3, "\u00E9");
    expect(rawBody.length).toBeLessThan(MAX_REQUEST_BODY_BYTES);

    const res = await call(echoHandler(), makeEvent({ path: "/api/v1/anything", rawBody, headers: JSON_HEADERS }));

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("refuses an oversized body that is not even JSON before parsing it", async () => {
    const res = await call(echoHandler(), makeEvent({
      path: "/api/v1/anything",
      rawBody: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
      headers: {},
    }));

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  describe.each(ROUTES)("$name", (route) => {
    it("passes a body just under the limit on to the body checks", async () => {
      const { handler, authorization } = await route.build();

      const res = await call(handler, makeEvent({
        path: route.path,
        rawBody: jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES - 1),
        headers: {
          ...JSON_HEADERS,
          ...(authorization
            ? { authorization }
            : {}),
        },
        pathParameters: route.pathParameters,
      }));

      expect(res.status).not.toBe(413);
      expect(res.body.code).not.toBe("PAYLOAD_TOO_LARGE");
    });

    it("returns 413 PAYLOAD_TOO_LARGE for a body one byte over the limit", async () => {
      const { handler, authorization } = await route.build();

      const res = await call(handler, makeEvent({
        path: route.path,
        rawBody: jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES + 1),
        headers: {
          ...JSON_HEADERS,
          ...(authorization
            ? { authorization }
            : {}),
        },
        pathParameters: route.pathParameters,
      }));

      expect(res.status).toBe(413);
      expect(res.body).toEqual({
        code: "PAYLOAD_TOO_LARGE",
        message: expect.any(String),
        details: { maxBytes: MAX_REQUEST_BODY_BYTES },
      });
    });
  });

  describe.each(ROUTES.filter(route => route.needsToken))("$name without a token", (route) => {
    it("returns 401, not 413, for an oversized body", async () => {
      const { handler } = await route.build();

      const res = await call(handler, makeEvent({
        path: route.path,
        rawBody: jsonBodyOfBytes(MAX_REQUEST_BODY_BYTES + 1),
        headers: JSON_HEADERS,
        pathParameters: route.pathParameters,
      }));

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
    });
  });
});

describe("an unexpected server error returns a generic 500 (api-hardening 01)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the error from the caller and logs its class, message and stack at error (structured-logging 03)", async () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "info", destination: sink });
    const failure = new TypeError("connection refused at /srv/app/src/db.ts:42");
    const handler = createApiHandler(async () => {
      throw failure;
    }, {}, "getGameSessionState") as unknown as Handler;

    const event = {
      ...makeEvent({ path: "/api/v1/anything", rawBody: null }),
      logger,
    };
    const res = await call(handler, event);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    const errorLines = sink.lines().filter(line => line.level === "error");
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0]!.err).toMatchObject({
      type: "TypeError",
      message: failure.message,
      stack: failure.stack,
    });
    expect(String((errorLines[0]!.err as { stack: string }).stack)).toMatch(/\n\s+at /);
  });

  it("does so on a real route when the repository throws", async () => {
    const session = makeChainMappingSession();
    const tokens = new FakeCapabilityTokenAdapter();
    const token = await tokens.signToken({ role: "participant", sessionId: session.sessionId.value, participantId: "p-1" });
    const brokenRepo: GameSessionRepositoryPort = {
      create: async () => {},
      findById: async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'x')");
      },
      findByRoomCode: async () => null,
      update: async () => {},
    } as unknown as GameSessionRepositoryPort;
    const handler = createSubmitChainHandler({
      packRepo: new InMemoryCurriculumPackRepository(),
      sessionRepo: brokenRepo,
      tokenVerifier: tokens,
    }) as unknown as Handler;

    const res = await call(handler, makeEvent({
      path: `/api/v1/sessions/${session.sessionId.value}/rounds/1/chains`,
      rawBody: JSON.stringify({
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        keywordIds: [],
        narrativeExplanation: "A story",
      }),
      headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
      pathParameters: { sessionId: session.sessionId.value, roundNumber: "1" },
    }));

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });
});
