import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import { randomBytes } from "node:crypto";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
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

const ALLOWED_STATUS_CODES = new Set([
  200,
  201,
  400,
  401,
  403,
  404,
  409,
  413,
  422,
  423,
]);

async function assertCleanFuzzResponse(res: Response): Promise<void> {
  expect(res.status).not.toBe(500);
  expect(ALLOWED_STATUS_CODES.has(res.status)).toBe(true);

  const rawText = await res.text();
  expect(rawText).not.toContain("node_modules");
  expect(rawText).not.toMatch(/\.ts:\d+/);
  expect(rawText).not.toMatch(/\bat\s+\S+\s+\(/);

  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  expect(typeof parsed).toBe("object");
  expect(parsed).not.toBeNull();

  if (res.status >= 400) {
    expect(typeof parsed.code).toBe("string");
    expect(typeof parsed.message).toBe("string");
  }
}

describe("fuzz Tests: HTTP Wrapper & Middy Middleware Pipeline", () => {
  const clock = new FakeClock(new Date("2026-04-01T10:00:00.000Z"));
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const accountRepo = new InMemoryInstructorAccountRepository();
  const passwordHasher = new Argon2PasswordHasher();
  const capabilityTokens = HmacCapabilityTokenAdapter.fromSecret(randomBytes(32).toString("hex"))!;
  const accountTokens = HmacAccountTokenAdapter.fromSecret(randomBytes(32).toString("hex"))!;
  const seededRandom = new SeedrandomSeededRandom();
  const seedGenerator = new CryptoBoardSeedGenerator();

  let idCounter = 0;
  const idGenerator = {
    generate: () => `fuzz-id-${++idCounter}`,
  };

  const sharedDeps = {
    accountRepo,
    packRepo,
    sessionRepo,
    passwordHasher,
    accountTokenSigner: accountTokens,
    accountTokenVerifier: accountTokens,
    tokenSigner: capabilityTokens,
    tokenVerifier: capabilityTokens,
    idGenerator,
    clock,
    seededRandom,
    seedGenerator,
    apiKey: undefined,
    requireApiKey: false,
  };

  const wrap = (handler: unknown, path: string) =>
    wrapLambdaHandler(handler as unknown as LambdaHandler, { path });

  const signUp = wrap(createSignUpHandler(sharedDeps), "/api/v1/accounts/sign-up");
  const signIn = wrap(createSignInHandler(sharedDeps), "/api/v1/accounts/sign-in");
  const registerPack = wrap(createRegisterPackHandler(sharedDeps), "/api/v1/packs");
  const createSession = wrap(createCreateSessionHandler(sharedDeps), "/api/v1/sessions");
  const joinSession = wrap(createJoinSessionHandler(sharedDeps), "/api/v1/sessions/join");
  const transitionPhase = wrap(createTransitionPhaseHandler(sharedDeps), "/api/v1/sessions/:sessionId/phase");
  const submitChain = wrap(createSubmitChainHandler(sharedDeps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains");
  const adjudicateChain = wrap(
    createAdjudicateChainHandler(sharedDeps),
    "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
  );
  const submitAssessment = wrap(createSubmitAssessmentHandler(sharedDeps), "/api/v1/sessions/:sessionId/assessments/:stage");
  const submitSurvey = wrap(createSubmitSurveyHandler(sharedDeps), "/api/v1/sessions/:sessionId/survey");

  let accountToken = "";
  let sessionId = "";
  let instructorToken = "";
  let participantToken = "";

  function invokeRaw(
    handler: (req: Request, ctx: Context) => Promise<Response>,
    path: string,
    rawBody: string | undefined,
    headers: Record<string, string>,
  ): Promise<Response> {
    const req = new Request(`http://localhost:8888${path}`, {
      method: "POST",
      headers,
      body: rawBody,
    });
    return handler(req, {} as Context);
  }

  beforeAll(async () => {
    accountToken = (await accountTokens.signAccountToken(
      {
        accountId: "acc-fuzz-1",
        email: "fuzz.teacher@aku.edu",
      },
      clock.now(),
    )).token;

    const createRes = await invokeRaw(
      createSession,
      "/api/v1/sessions",
      JSON.stringify({
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      }),
      {
        "content-type": "application/json",
        "authorization": `Bearer ${accountToken}`,
      },
    );
    const created = (await createRes.json()) as {
      sessionId: string;
      roomCode: string;
      instructorToken: string;
    };
    sessionId = created.sessionId;
    instructorToken = created.instructorToken;

    const joinRes = await invokeRaw(
      joinSession,
      "/api/v1/sessions/join",
      JSON.stringify({
        roomCode: created.roomCode,
        displayName: "Fuzz Learner",
      }),
      { "content-type": "application/json" },
    );
    const joined = (await joinRes.json()) as { participantToken: string };
    participantToken = joined.participantToken;
  });

  it("fuzzes arbitrary raw body strings, malformed JSON, arrays, primitives, and null bodies without ever returning 500", async () => {
    const rawBodyArb = fc.oneof(
      fc.string({ maxLength: 512 }),
      fc.constantFrom(
        "",
        "null",
        "true",
        "false",
        "12345",
        "\"just-a-string\"",
        "[1, 2, 3]",
        "{",
        "{\"unterminated\": ",
        "{\"__proto__\": {\"polluted\": true}}",
        "{\"constructor\": {\"prototype\": {\"polluted\": true}}}",
      ),
    );

    await fc.assert(
      fc.asyncProperty(
        rawBodyArb,
        fc.constantFrom(
          "application/json",
          "application/json; charset=utf-8",
          "text/plain",
          "",
        ),
        async (rawBody, contentType) => {
          const headers: Record<string, string> = {
            authorization: `Bearer ${participantToken}`,
          };
          if (contentType) {
            headers["content-type"] = contentType;
          }

          const res = await invokeRaw(
            submitChain,
            `/api/v1/sessions/${sessionId}/rounds/1/chains`,
            rawBody,
            headers,
          );
          await assertCleanFuzzResponse(res);
          expect([400, 401, 403]).toContain(res.status);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("fuzzes arbitrary JSON objects and prototype-pollution payloads across all write routes with valid tokens", async () => {
    const fuzzedObjectArb = fc.oneof(
      fc.dictionary(fc.string({ maxLength: 24 }), fc.jsonValue({ maxDepth: 2 })),
      fc.record({
        email: fc.jsonValue({ maxDepth: 1 }),
        password: fc.jsonValue({ maxDepth: 1 }),
        roomCode: fc.jsonValue({ maxDepth: 1 }),
        packId: fc.jsonValue({ maxDepth: 1 }),
        mode: fc.jsonValue({ maxDepth: 1 }),
        adjudicationMode: fc.jsonValue({ maxDepth: 1 }),
        action: fc.jsonValue({ maxDepth: 1 }),
        path: fc.jsonValue({ maxDepth: 2 }),
        narrativeExplanation: fc.jsonValue({ maxDepth: 1 }),
        answers: fc.jsonValue({ maxDepth: 1 }),
        responses: fc.jsonValue({ maxDepth: 1 }),
      }),
      fc.constantFrom(
        JSON.parse("{\"__proto__\":{\"admin\":true,\"role\":\"instructor\"}}") as Record<string, unknown>,
        {
          constructor: {
            prototype: { isAdmin: true },
          },
          toString: "boom",
          valueOf: null,
        },
        { action: "jump", targetPhase: "__proto__" },
        {
          path: [
            { row: -1, col: Number.MAX_SAFE_INTEGER },
          ],
          narrativeExplanation: "",
        },
        {
          answers: { __proto__: "I_DONT_KNOW", constructor: 99 },
        },
        {
          responses: { "s-1": -999, "__proto__": 5 },
          comments: "x".repeat(500),
        },
      ),
    );

    const routes: Array<{
      name: string;
      handler: (req: Request, ctx: Context) => Promise<Response>;
      path: () => string;
      token: () => string | undefined;
    }> = [
      {
        name: "signUpInstructor",
        handler: signUp,
        path: () => "/api/v1/accounts/sign-up",
        token: () => undefined,
      },
      {
        name: "signInInstructor",
        handler: signIn,
        path: () => "/api/v1/accounts/sign-in",
        token: () => undefined,
      },
      {
        name: "registerCurriculumPack",
        handler: registerPack,
        path: () => "/api/v1/packs",
        token: () => accountToken,
      },
      {
        name: "createGameSession",
        handler: createSession,
        path: () => "/api/v1/sessions",
        token: () => accountToken,
      },
      {
        name: "joinGameSession",
        handler: joinSession,
        path: () => "/api/v1/sessions/join",
        token: () => undefined,
      },
      {
        name: "transitionSessionPhase",
        handler: transitionPhase,
        path: () => `/api/v1/sessions/${sessionId}/phase`,
        token: () => instructorToken,
      },
      {
        name: "submitConceptChain",
        handler: submitChain,
        path: () => `/api/v1/sessions/${sessionId}/rounds/1/chains`,
        token: () => participantToken,
      },
      {
        name: "adjudicateConceptChain",
        handler: adjudicateChain,
        path: () => `/api/v1/sessions/${sessionId}/rounds/1/chains/chain-fuzz/adjudicate`,
        token: () => participantToken,
      },
      {
        name: "submitAssessmentAttempt",
        handler: submitAssessment,
        path: () => `/api/v1/sessions/${sessionId}/assessments/pretest`,
        token: () => participantToken,
      },
      {
        name: "submitPerceptionSurvey",
        handler: submitSurvey,
        path: () => `/api/v1/sessions/${sessionId}/survey`,
        token: () => participantToken,
      },
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: routes.length - 1 }),
        fuzzedObjectArb,
        async (routeIdx, payload) => {
          const target = routes[routeIdx]!;
          const headers: Record<string, string> = {
            "content-type": "application/json",
          };
          const tok = target.token();
          if (tok) {
            headers.authorization = `Bearer ${tok}`;
          }

          const res = await invokeRaw(
            target.handler,
            target.path(),
            JSON.stringify(payload),
            headers,
          );
          await assertCleanFuzzResponse(res);
          // Prototype should never be polluted
          expect(({} as Record<string, unknown>).admin).toBeUndefined();
          expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        },
      ),
      { numRuns: 80 },
    );
  });

  it("fuzzes Authorization header strings and URL path parameters without unhandled exceptions", async () => {
    const headerValueArb = fc.oneof(
      fc.stringMatching(/^[\w.~+/=-]{0,120}$/),
      fc.stringMatching(/^[\w.-]{1,40}\.[\w.-]{1,40}\.[\w.-]{1,40}$/).map(jwt => `Bearer ${jwt}`),
      fc.constantFrom(
        "",
        "Bearer",
        "Bearer ",
        "Basic dXNlcjpwYXNz",
        "Bearer a.b.c.d.e",
        "Bearer ..",
        "Token 12345",
      ),
    );

    const pathSegmentArb = fc.oneof(
      fc.stringMatching(/^[\w.~-]{1,32}$/),
      fc.constantFrom(
        "0",
        "1",
        "2",
        "3",
        "-1",
        "999999",
        "NaN",
        "pretest",
        "posttest",
        "invalid-stage",
        "__proto__",
        "constructor",
      ),
    );

    await fc.assert(
      fc.asyncProperty(
        headerValueArb,
        pathSegmentArb,
        pathSegmentArb,
        async (authHeader, fuzzedSessionId, fuzzedRoundOrStage) => {
          // 1. Fuzzed Authorization header against protected endpoint
          const authRes = await invokeRaw(
            transitionPhase,
            `/api/v1/sessions/${sessionId}/phase`,
            JSON.stringify({ action: "advance" }),
            {
              "content-type": "application/json",
              "authorization": authHeader,
            },
          );
          await assertCleanFuzzResponse(authRes);
          expect(authRes.status).toBe(401);

          // 2. Fuzzed URL path parameters with valid participant token
          const chainRes = await invokeRaw(
            submitChain,
            `/api/v1/sessions/${encodeURIComponent(fuzzedSessionId)}/rounds/${encodeURIComponent(fuzzedRoundOrStage)}/chains`,
            JSON.stringify({
              path: [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
                { row: 0, col: 2 },
                { row: 0, col: 3 },
              ],
              narrativeExplanation: "Fuzzed path params check",
            }),
            {
              "content-type": "application/json",
              "authorization": `Bearer ${participantToken}`,
            },
          );
          await assertCleanFuzzResponse(chainRes);
          expect([400, 401, 403, 404, 409]).toContain(chainRes.status);

          // 3. Fuzzed assessment stage path parameter with valid participant token for that session
          const stageRes = await invokeRaw(
            submitAssessment,
            `/api/v1/sessions/${sessionId}/assessments/${encodeURIComponent(fuzzedRoundOrStage)}`,
            JSON.stringify({ answers: {} }),
            {
              "content-type": "application/json",
              "authorization": `Bearer ${participantToken}`,
            },
          );
          await assertCleanFuzzResponse(stageRes);
          expect([400, 401, 404, 409, 422]).toContain(stageRes.status);
        },
      ),
      { numRuns: 50 },
    );
  });
});
