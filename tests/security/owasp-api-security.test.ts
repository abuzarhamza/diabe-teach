import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createGetCurrentAccountHandler } from "../../netlify/functions/accounts/get-current-account.js";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
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

function base64UrlEncode(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function forgeUnsignedAlgNoneJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: "none", typ: "JWT" });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.`;
}

function tamperJwtPayload(validJwt: string, mutator: (payload: Record<string, unknown>) => void): string {
  const [headerB64, payloadB64, signatureB64] = validJwt.split(".");
  const decoded = JSON.parse(Buffer.from(payloadB64!, "base64url").toString("utf8")) as Record<string, unknown>;
  mutator(decoded);
  return `${headerB64}.${base64UrlEncode(decoded)}.${signatureB64}`;
}

describe("penetration & API Security Tests: OWASP API Top 10 & Cross-Session BOLA/IDOR Matrix", () => {
  const capabilitySecret = randomBytes(32).toString("hex");
  const accountSecret = randomBytes(32).toString("hex");
  const clock = new FakeClock(new Date("2026-04-01T10:00:00.000Z"));
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = new InMemoryGameSessionRepository();
  const accountRepo = new InMemoryInstructorAccountRepository();
  const passwordHasher = new Argon2PasswordHasher();
  const capabilityTokens = HmacCapabilityTokenAdapter.fromSecret(capabilitySecret)!;
  const accountTokens = HmacAccountTokenAdapter.fromSecret(accountSecret, clock)!;
  const seededRandom = new SeedrandomSeededRandom();
  const seedGenerator = new CryptoBoardSeedGenerator();

  let idCounter = 0;
  const idGenerator = {
    generate: () => `sec-id-${++idCounter}`,
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
  const getCurrentAccount = wrap(createGetCurrentAccountHandler(sharedDeps), "/api/v1/accounts/me");
  const createSession = wrap(createCreateSessionHandler(sharedDeps), "/api/v1/sessions");
  const joinSession = wrap(createJoinSessionHandler(sharedDeps), "/api/v1/sessions/join");
  const getSessionState = wrap(createGetSessionHandler(sharedDeps), "/api/v1/sessions/:sessionId");
  const transitionPhase = wrap(createTransitionPhaseHandler(sharedDeps), "/api/v1/sessions/:sessionId/phase");
  const extendPhase = wrap(createExtendPhaseHandler(sharedDeps), "/api/v1/sessions/:sessionId/phase/extend");
  const endSession = wrap(createEndSessionHandler(sharedDeps), "/api/v1/sessions/:sessionId/end");
  const leaveSession = wrap(createLeaveSessionHandler(sharedDeps), "/api/v1/sessions/:sessionId/leave");
  const submitChain = wrap(createSubmitChainHandler(sharedDeps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains");
  const listRoundChains = wrap(createListRoundChainsHandler(sharedDeps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains");
  const adjudicateChain = wrap(
    createAdjudicateChainHandler(sharedDeps),
    "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
  );
  const getStandings = wrap(createGetStandingsHandler(sharedDeps), "/api/v1/sessions/:sessionId/rounds/:roundNumber/standings");
  const submitAssessment = wrap(createSubmitAssessmentHandler(sharedDeps), "/api/v1/sessions/:sessionId/assessments/:stage");
  const submitSurvey = wrap(createSubmitSurveyHandler(sharedDeps), "/api/v1/sessions/:sessionId/survey");
  const getAnalytics = wrap(createGetSessionAnalyticsHandler(sharedDeps), "/api/v1/sessions/:sessionId/analytics");

  function invoke(
    handler: (req: Request, ctx: Context) => Promise<Response>,
    method: string,
    path: string,
    options?: {
      token?: string;
      body?: unknown;
    },
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options?.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    if (options?.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const req = new Request(`http://localhost:8888${path}`, {
      method,
      headers,
      body: options?.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    });
    return handler(req, {} as Context);
  }

  let accountId = "";
  let accountToken = "";
  let sessionAId = "";
  let sessionAInstructorToken = "";
  let sessionAParticipantToken = "";
  let sessionAChainId = "";
  let sessionBId = "";

  const validPretestAnswers = Object.fromEntries(
    (DIABE_TEACH_PACK.assessmentInstrument?.questions ?? []).map(q => [q.id, 0]),
  );

  beforeAll(async () => {
    const signUpRes = await invoke(signUp, "POST", "/api/v1/accounts/sign-up", {
      body: {
        email: "sec.instructor@aku.edu",
        password: "StrongPassword123!",
      },
    });
    expect(signUpRes.status).toBe(201);
    const signedUp = (await signUpRes.json()) as { accountId: string; accountToken: string };
    accountId = signedUp.accountId;
    accountToken = signedUp.accountToken;

    // Create Session A
    const createARes = await invoke(createSession, "POST", "/api/v1/sessions", {
      token: accountToken,
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      },
    });
    const createdA = (await createARes.json()) as {
      sessionId: string;
      roomCode: string;
      instructorToken: string;
    };
    sessionAId = createdA.sessionId;
    sessionAInstructorToken = createdA.instructorToken;

    const joinARes = await invoke(joinSession, "POST", "/api/v1/sessions/join", {
      body: {
        roomCode: createdA.roomCode,
        displayName: "Learner A",
      },
    });
    const joinedA = (await joinARes.json()) as { participantToken: string };
    sessionAParticipantToken = joinedA.participantToken;

    // Advance Session A to round-1:chain-mapping and submit a chain so we have a valid chainId
    await invoke(transitionPhase, "POST", `/api/v1/sessions/${sessionAId}/phase`, {
      token: sessionAInstructorToken,
      body: { action: "advance" },
    });
    await invoke(transitionPhase, "POST", `/api/v1/sessions/${sessionAId}/phase`, {
      token: sessionAInstructorToken,
      body: { action: "advance", seed: "sec-seed-r1" },
    });
    const chainRes = await invoke(
      submitChain,
      "POST",
      `/api/v1/sessions/${sessionAId}/rounds/1/chains`,
      {
        token: sessionAParticipantToken,
        body: {
          path: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 0, col: 3 },
          ],
          narrativeExplanation: "Valid security test chain",
        },
      },
    );
    expect(chainRes.status).toBe(201);
    const submittedChain = (await chainRes.json()) as { chain: { chainId: string } };
    sessionAChainId = submittedChain.chain.chainId;

    // Create Session B
    const createBRes = await invoke(createSession, "POST", "/api/v1/sessions", {
      token: accountToken,
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
      },
    });
    const createdB = (await createBRes.json()) as { sessionId: string };
    sessionBId = createdB.sessionId;
  });

  describe("aPI2 — Broken Authentication (JWT Cryptographic & Header Attacks)", () => {
    it("rejects alg: 'none' unsigned JWT tokens for both AccountAuth and BearerAuth routes with 401 UNAUTHORIZED_TOKEN", async () => {
      const unsignedAccountJwt = forgeUnsignedAlgNoneJwt({
        kind: "account",
        sub: accountId,
        email: "sec.instructor@aku.edu",
        iat: Math.floor(clock.now().getTime() / 1000),
        exp: Math.floor(clock.now().getTime() / 1000) + 3600,
      });

      const accountRes = await invoke(getCurrentAccount, "GET", "/api/v1/accounts/me", {
        token: unsignedAccountJwt,
      });
      expect(accountRes.status).toBe(401);
      expect(((await accountRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");

      const unsignedCapabilityJwt = forgeUnsignedAlgNoneJwt({
        kind: "capability",
        role: "instructor",
        sessionId: sessionAId,
      });

      const sessionRes = await invoke(
        getSessionState,
        "GET",
        `/api/v1/sessions/${sessionAId}`,
        { token: unsignedCapabilityJwt },
      );
      expect(sessionRes.status).toBe(401);
      expect(((await sessionRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");
    });

    it("rejects cross-secret key confusion tokens even when the attacker forges the target 'kind' claim", async () => {
      // Attacker uses CAPABILITY_TOKEN_SECRET to sign a JWT with kind: "account"
      const forgedAccountWithCapabilitySecret = await new SignJWT({
        kind: "account",
        email: "sec.instructor@aku.edu",
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(accountId)
        .setIssuedAt(Math.floor(clock.now().getTime() / 1000))
        .setExpirationTime(Math.floor(clock.now().getTime() / 1000) + 3600)
        .sign(new TextEncoder().encode(capabilitySecret));

      const accountRes = await invoke(getCurrentAccount, "GET", "/api/v1/accounts/me", {
        token: forgedAccountWithCapabilitySecret,
      });
      expect(accountRes.status).toBe(401);
      expect(((await accountRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");

      // Attacker uses ACCOUNT_TOKEN_SECRET to sign a JWT with kind: "capability"
      const forgedCapabilityWithAccountSecret = await new SignJWT({
        kind: "capability",
        role: "instructor",
        sessionId: sessionAId,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .sign(new TextEncoder().encode(accountSecret));

      const sessionRes = await invoke(
        transitionPhase,
        "POST",
        `/api/v1/sessions/${sessionAId}/phase`,
        {
          token: forgedCapabilityWithAccountSecret,
          body: { action: "advance" },
        },
      );
      expect(sessionRes.status).toBe(401);
      expect(((await sessionRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");
    });

    it("rejects tampered JWT payload claims (escalating role to instructor or changing sessionId without re-signing) with 401", async () => {
      const roleEscalatedJwt = tamperJwtPayload(sessionAParticipantToken, (payload) => {
        payload.role = "instructor";
      });

      const roleRes = await invoke(
        transitionPhase,
        "POST",
        `/api/v1/sessions/${sessionAId}/phase`,
        {
          token: roleEscalatedJwt,
          body: { action: "advance" },
        },
      );
      expect(roleRes.status).toBe(401);
      expect(((await roleRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");

      const sessionSwappedJwt = tamperJwtPayload(sessionAInstructorToken, (payload) => {
        payload.sessionId = sessionBId;
      });

      const sessionRes = await invoke(
        getSessionState,
        "GET",
        `/api/v1/sessions/${sessionBId}`,
        { token: sessionSwappedJwt },
      );
      expect(sessionRes.status).toBe(401);
      expect(((await sessionRes.json()) as { code: string }).code).toBe("UNAUTHORIZED_TOKEN");
    });
  });

  describe("aPI1 & API5 — Broken Object Level Authorization (Cross-Session BOLA/IDOR) & Role Matrix", () => {
    it("refuses Session A instructorToken and participantToken across all 13 session-scoped endpoints when targeting Session B (403 FORBIDDEN_ROLE)", async () => {
      const sessionBEndpoints: Array<{
        name: string;
        handler: (req: Request, ctx: Context) => Promise<Response>;
        method: string;
        path: string;
        body?: unknown;
      }> = [
        {
          name: "getGameSessionState",
          handler: getSessionState,
          method: "GET",
          path: `/api/v1/sessions/${sessionBId}`,
        },
        {
          name: "transitionSessionPhase",
          handler: transitionPhase,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/phase`,
          body: { action: "advance" },
        },
        {
          name: "extendSessionPhase",
          handler: extendPhase,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/phase/extend`,
          body: { seconds: 60 },
        },
        {
          name: "endGameSession",
          handler: endSession,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/end`,
        },
        {
          name: "leaveGameSession",
          handler: leaveSession,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/leave`,
        },
        {
          name: "submitConceptChain",
          handler: submitChain,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/rounds/1/chains`,
          body: {
            path: [
              { row: 0, col: 0 },
              { row: 0, col: 1 },
              { row: 0, col: 2 },
              { row: 0, col: 3 },
            ],
            narrativeExplanation: "Cross-session BOLA attempt",
          },
        },
        {
          name: "listRoundChains",
          handler: listRoundChains,
          method: "GET",
          path: `/api/v1/sessions/${sessionBId}/rounds/1/chains`,
        },
        {
          name: "adjudicateConceptChain",
          handler: adjudicateChain,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/rounds/1/chains/${sessionAChainId}/adjudicate`,
          body: { action: "peer-approve" },
        },
        {
          name: "getRoundStandings",
          handler: getStandings,
          method: "GET",
          path: `/api/v1/sessions/${sessionBId}/rounds/1/standings`,
        },
        {
          name: "submitAssessmentAttempt (pretest)",
          handler: submitAssessment,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/assessments/pretest`,
          body: { answers: validPretestAnswers },
        },
        {
          name: "submitAssessmentAttempt (posttest)",
          handler: submitAssessment,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/assessments/posttest`,
          body: { answers: validPretestAnswers },
        },
        {
          name: "submitPerceptionSurvey",
          handler: submitSurvey,
          method: "POST",
          path: `/api/v1/sessions/${sessionBId}/survey`,
          body: {
            responses: { "s-1": 5 },
          },
        },
        {
          name: "getSessionAnalytics",
          handler: getAnalytics,
          method: "GET",
          path: `/api/v1/sessions/${sessionBId}/analytics`,
        },
      ];

      expect(sessionBEndpoints.length).toBe(13);

      for (const endpoint of sessionBEndpoints) {
        for (const token of [sessionAInstructorToken, sessionAParticipantToken]) {
          const res = await invoke(endpoint.handler, endpoint.method, endpoint.path, {
            token,
            body: endpoint.body,
          });
          expect(res.status, `${endpoint.name} should return 403 for cross-session token`).toBe(403);
          const err = (await res.json()) as { code: string };
          expect(err.code).toBe("FORBIDDEN_ROLE");
        }
      }
    });

    it("enforces intra-session Function-Level Authorization (participant refused on instructor actions; instructor refused on learner write actions)", async () => {
      // 1. Participant token refused on instructor-only operations within Session A
      const instructorOnlyCalls: Array<{
        name: string;
        handler: (req: Request, ctx: Context) => Promise<Response>;
        path: string;
        body?: unknown;
      }> = [
        {
          name: "transitionSessionPhase",
          handler: transitionPhase,
          path: `/api/v1/sessions/${sessionAId}/phase`,
          body: { action: "advance" },
        },
        {
          name: "extendSessionPhase",
          handler: extendPhase,
          path: `/api/v1/sessions/${sessionAId}/phase/extend`,
          body: { seconds: 60 },
        },
        {
          name: "endGameSession",
          handler: endSession,
          path: `/api/v1/sessions/${sessionAId}/end`,
        },
        {
          name: "adjudicateConceptChain (instructor-approve)",
          handler: adjudicateChain,
          path: `/api/v1/sessions/${sessionAId}/rounds/1/chains/${sessionAChainId}/adjudicate`,
          body: { action: "instructor-approve", feedback: "Forged ruling" },
        },
        {
          name: "adjudicateConceptChain (instructor-reject)",
          handler: adjudicateChain,
          path: `/api/v1/sessions/${sessionAId}/rounds/1/chains/${sessionAChainId}/adjudicate`,
          body: { action: "instructor-reject", feedback: "Forged ruling" },
        },
      ];

      for (const call of instructorOnlyCalls) {
        const res = await invoke(call.handler, "POST", call.path, {
          token: sessionAParticipantToken,
          body: call.body,
        });
        expect(res.status, `${call.name} should refuse participantToken with 403`).toBe(403);
        expect(((await res.json()) as { code: string }).code).toBe("FORBIDDEN_ROLE");
      }

      // 2. Instructor token refused on learner-only write operations within Session A
      const participantOnlyCalls: Array<{
        name: string;
        handler: (req: Request, ctx: Context) => Promise<Response>;
        path: string;
        body?: unknown;
      }> = [
        {
          name: "leaveGameSession",
          handler: leaveSession,
          path: `/api/v1/sessions/${sessionAId}/leave`,
        },
        {
          name: "submitConceptChain",
          handler: submitChain,
          path: `/api/v1/sessions/${sessionAId}/rounds/1/chains`,
          body: {
            path: [
              { row: 1, col: 0 },
              { row: 1, col: 1 },
              { row: 1, col: 2 },
              { row: 1, col: 3 },
            ],
            narrativeExplanation: "Instructor attempting learner chain submission",
          },
        },
        {
          name: "adjudicateConceptChain (peer-approve)",
          handler: adjudicateChain,
          path: `/api/v1/sessions/${sessionAId}/rounds/1/chains/${sessionAChainId}/adjudicate`,
          body: { action: "peer-approve" },
        },
        {
          name: "submitAssessmentAttempt (pretest)",
          handler: submitAssessment,
          path: `/api/v1/sessions/${sessionAId}/assessments/pretest`,
          body: { answers: validPretestAnswers },
        },
        {
          name: "submitPerceptionSurvey",
          handler: submitSurvey,
          path: `/api/v1/sessions/${sessionAId}/survey`,
          body: {
            responses: { "s-1": 5 },
          },
        },
      ];

      for (const call of participantOnlyCalls) {
        const res = await invoke(call.handler, "POST", call.path, {
          token: sessionAInstructorToken,
          body: call.body,
        });
        expect(res.status, `${call.name} should refuse instructorToken with 403`).toBe(403);
        expect(((await res.json()) as { code: string }).code).toBe("FORBIDDEN_ROLE");
      }
    });
  });

  describe("aPI3 & API8 — NoSQL Operator Injection & Schema Enforcement", () => {
    it("rejects MongoDB query operator objects ($gt, $ne, $where) in email, password, roomCode, packId, and answers with 400 INVALID_REQUEST_BODY", async () => {
      const injectionCases: Array<{
        name: string;
        handler: (req: Request, ctx: Context) => Promise<Response>;
        path: string;
        token?: string;
        body: unknown;
      }> = [
        {
          name: "signUp email $gt operator",
          handler: signUp,
          path: "/api/v1/accounts/sign-up",
          body: {
            email: { $gt: "" },
            password: "StrongPassword123!",
          },
        },
        {
          name: "signIn password $ne operator",
          handler: signIn,
          path: "/api/v1/accounts/sign-in",
          body: {
            email: "sec.instructor@aku.edu",
            password: { $ne: null },
          },
        },
        {
          name: "joinSession roomCode $gt operator",
          handler: joinSession,
          path: "/api/v1/sessions/join",
          body: {
            roomCode: { $gt: "" },
            displayName: "Attacker",
          },
        },
        {
          name: "createSession packId $where operator",
          handler: createSession,
          path: "/api/v1/sessions",
          token: accountToken,
          body: {
            packId: { $where: "1==1" },
            mode: "classroom",
            adjudicationMode: "peer-instructor",
          },
        },
        {
          name: "submitAssessment answers $ne operator",
          handler: submitAssessment,
          path: `/api/v1/sessions/${sessionAId}/assessments/pretest`,
          token: sessionAParticipantToken,
          body: {
            answers: {
              q1: { $ne: -1 },
            },
          },
        },
      ];

      for (const testCase of injectionCases) {
        const res = await invoke(testCase.handler, "POST", testCase.path, {
          token: testCase.token,
          body: testCase.body,
        });
        expect(res.status, `${testCase.name} should return 400`).toBe(400);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe("INVALID_REQUEST_BODY");
      }
    });
  });
});
