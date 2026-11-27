import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import type { LoggerPort } from "../../src/application/ports/logger.port.js";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createListRoundChainsHandler } from "../../netlify/functions/sessions/list-round-chains.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
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
import { PinoLogger } from "../../src/adapters/outbound/pino-logger.js";
import { SeedrandomSeededRandom } from "../../src/adapters/outbound/seedrandom-seeded-random.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";

type LambdaHandler = (event: APIGatewayProxyEvent, context: LambdaContext) => Promise<APIGatewayProxyResult>;
type Line = Record<string, unknown>;

const EMAIL = "rahman.s@aku.edu";
const ROUTES = {
  signUp: "/api/v1/accounts/sign-up",
  signIn: "/api/v1/accounts/sign-in",
  packs: "/api/v1/packs",
  sessions: "/api/v1/sessions",
  join: "/api/v1/sessions/join",
  phase: "/api/v1/sessions/:sessionId/phase",
  chains: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains",
  adjudicate: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
} as const;

function minimalPack(): Record<string, unknown> {
  return {
    id: "log-test-pack",
    title: "Log Test Pack",
    version: "1.0.0",
    description: "A pack for the key-event log tests.",
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
    authorName: "Test Author",
  };
}

/**
 * Every route the journey calls, each wrapped as its Netlify v2 entrypoint
 * with one shared sink logger, so every line is captured with its request id.
 */
function makeApi(logger: LoggerPort) {
  const key = randomBytes(32).toString("hex");
  const clock = new FakeClock(new Date("2026-11-20T08:00:00.000Z"));
  const accountTokens = new HmacAccountTokenAdapter(key, clock);
  const capabilityTokens = new HmacCapabilityTokenAdapter(randomBytes(32).toString("hex"));
  const accountRepo = new InMemoryInstructorAccountRepository();
  const packRepo = new InMemoryCurriculumPackRepository();
  const sessionRepo = new InMemoryGameSessionRepository();
  let nextId = 0;
  const shared = {
    accountRepo,
    packRepo,
    sessionRepo,
    passwordHasher: new Argon2PasswordHasher(),
    accountTokenSigner: accountTokens,
    accountTokenVerifier: accountTokens,
    tokenSigner: capabilityTokens,
    tokenVerifier: capabilityTokens,
    idGenerator: {
      generate: () => `account-${++nextId}`,
    },
    clock,
    seededRandom: new SeedrandomSeededRandom(),
    seedGenerator: new CryptoBoardSeedGenerator(),
    apiKey: undefined,
    requireApiKey: false,
  };
  const wrap = (handler: unknown, path: string) =>
    wrapLambdaHandler(handler as LambdaHandler, { path }, { logger });

  let requestCount = 0;
  const call = async (
    route: ReturnType<typeof wrap>,
    method: string,
    url: string,
    options: { body?: unknown; token?: string } = {},
  ): Promise<{ status: number; json: Record<string, any>; requestId: string }> => {
    const requestId = `req-${++requestCount}`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    const response = await route(
      new Request(`http://localhost:8888${url}`, {
        method,
        headers,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      }),
      { params: {}, requestId, ip: "127.0.0.1" } as unknown as Context,
    );
    const text = await response.text();
    return {
      status: response.status,
      json: text
        ? JSON.parse(text)
        : {},
      requestId,
    };
  };

  return {
    clock,
    accountRepo,
    sessionRepo,
    call,
    signUp: wrap(createSignUpHandler(shared), ROUTES.signUp),
    signIn: wrap(createSignInHandler(shared), ROUTES.signIn),
    registerPack: wrap(createRegisterPackHandler(shared), ROUTES.packs),
    createSession: wrap(createCreateSessionHandler(shared), ROUTES.sessions),
    join: wrap(createJoinSessionHandler(shared), ROUTES.join),
    transition: wrap(createTransitionPhaseHandler(shared), ROUTES.phase),
    submitChain: wrap(createSubmitChainHandler(shared), ROUTES.chains),
    listChains: wrap(createListRoundChainsHandler(shared), ROUTES.chains),
    adjudicate: wrap(createAdjudicateChainHandler(shared), ROUTES.adjudicate),
  };
}

type Api = ReturnType<typeof makeApi>;

interface JourneySecrets {
  readonly password: string;
  readonly passwordHash: string;
  readonly accountToken: string;
  readonly instructorToken: string;
  readonly participantToken: string;
  readonly displayName: string;
  readonly narrative: string;
}

/**
 * Sign-up → pack register → create session → join → advance into Round 1
 * (board deal) → submit chain → list chains → instructor ruling. Returns the
 * request id of each step and every secret the journey handled.
 */
async function runJourney(api: Api) {
  const password = `pw-${randomBytes(8).toString("hex")}`;
  const displayName = `Learner ${randomBytes(4).toString("hex")}`;
  const narrative = `narrative-${randomBytes(6).toString("hex")}`;

  const signUp = await api.call(api.signUp, "POST", ROUTES.signUp, {
    body: { email: EMAIL, password },
  });
  expect(signUp.status).toBe(201);
  const accountToken = signUp.json.accountToken as string;
  const accountId = signUp.json.accountId as string;

  const register = await api.call(api.registerPack, "POST", ROUTES.packs, {
    body: minimalPack(),
    token: accountToken,
  });
  expect(register.status).toBe(201);

  const create = await api.call(api.createSession, "POST", ROUTES.sessions, {
    body: { packId: "log-test-pack", mode: "classroom", adjudicationMode: "peer-instructor" },
    token: accountToken,
  });
  expect(create.status).toBe(201);
  const sessionId = create.json.sessionId as string;
  const instructorToken = create.json.instructorToken as string;

  const join = await api.call(api.join, "POST", ROUTES.join, {
    body: { roomCode: create.json.roomCode, displayName },
  });
  expect(join.status).toBe(200);
  const participantId = join.json.participantId as string;
  const participantToken = join.json.participantToken as string;

  const phaseUrl = `/api/v1/sessions/${sessionId}/phase`;
  const toOrientation = await api.call(api.transition, "POST", phaseUrl, {
    body: { action: "advance" },
    token: instructorToken,
  });
  expect(toOrientation.status).toBe(200);
  const toRound1 = await api.call(api.transition, "POST", phaseUrl, {
    body: { action: "advance", seed: "log-test-seed" },
    token: instructorToken,
  });
  expect(toRound1.status).toBe(200);

  const chainsUrl = `/api/v1/sessions/${sessionId}/rounds/1/chains`;
  const submit = await api.call(api.submitChain, "POST", chainsUrl, {
    body: {
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ],
      keywordIds: ["x", "y", "z"],
      narrativeExplanation: narrative,
    },
    token: participantToken,
  });
  expect(submit.status).toBe(201);
  const chainId = submit.json.chain.chainId as string;

  const list = await api.call(api.listChains, "GET", chainsUrl, { token: instructorToken });
  expect(list.status).toBe(200);

  const ruling = await api.call(api.adjudicate, "POST", `${chainsUrl}/${chainId}/adjudicate`, {
    body: { action: "instructor-approve", feedback: narrative },
    token: instructorToken,
  });
  expect(ruling.status).toBe(200);

  const stored = await api.accountRepo.findByEmail(EMAIL);
  const secrets: JourneySecrets = {
    password,
    passwordHash: stored!.passwordHash,
    accountToken,
    instructorToken,
    participantToken,
    displayName,
    narrative,
  };
  return {
    secrets,
    ids: {
      accountId,
      sessionId,
      participantId,
      chainId,
    },
    requestIds: {
      signUp: signUp.requestId,
      register: register.requestId,
      create: create.requestId,
      join: join.requestId,
      toRound1: toRound1.requestId,
      submit: submit.requestId,
      list: list.requestId,
      ruling: ruling.requestId,
    },
  };
}

function debugSink() {
  const sink = new InMemoryLogSink();
  return {
    sink,
    logger: PinoLogger.create({ level: "debug", destination: sink }),
  };
}

function lineWith(sink: InMemoryLogSink, msg: string, requestId?: string): Line | undefined {
  return sink.lines().find(line => line.msg === msg && (requestId === undefined || line.requestId === requestId));
}

/** Short prefixes of the secrets found in `raw` (ticket 04's check), so a failure never prints a whole secret. */
function leakedSecrets(raw: string, secrets: JourneySecrets): string[] {
  const values = [
    secrets.password,
    secrets.passwordHash,
    secrets.accountToken,
    secrets.instructorToken,
    secrets.participantToken,
    secrets.displayName,
    secrets.narrative,
    EMAIL,
    "Bearer ",
  ];
  return values.filter(value => raw.includes(value)).map(value => `${value.slice(0, 6)}…`);
}

describe("key events log at info with the request id (structured-logging ticket 06)", () => {
  it("each step of the journey writes its info line with the listed fields and its requestId", async () => {
    const { sink, logger } = debugSink();
    const api = makeApi(logger);
    const { ids, requestIds } = await runJourney(api);

    expect(lineWith(sink, "instructor signed up", requestIds.signUp)).toMatchObject({
      level: "info",
      accountId: ids.accountId,
    });
    expect(lineWith(sink, "pack registered", requestIds.register)).toMatchObject({
      level: "info",
      packId: "log-test-pack",
      version: "1.0.0",
      accountId: ids.accountId,
    });
    expect(lineWith(sink, "session created", requestIds.create)).toMatchObject({
      level: "info",
      sessionId: ids.sessionId,
      mode: "classroom",
      packId: "log-test-pack",
      packVersion: "1.0.0",
    });
    expect(lineWith(sink, "learner joined", requestIds.join)).toMatchObject({
      level: "info",
      sessionId: ids.sessionId,
      participantId: ids.participantId,
    });
    expect(lineWith(sink, "session phase changed", requestIds.toRound1)).toMatchObject({
      level: "info",
      sessionId: ids.sessionId,
      from: "trial-orientation",
      to: "round-1:chain-mapping",
    });
    expect(lineWith(sink, "chain submitted", requestIds.submit)).toMatchObject({
      level: "info",
      sessionId: ids.sessionId,
      roundNumber: 1,
      chainId: ids.chainId,
      length: 3,
    });
    expect(lineWith(sink, "chain instructor ruling", requestIds.ruling)).toMatchObject({
      level: "info",
      sessionId: ids.sessionId,
      chainId: ids.chainId,
      approved: true,
    });
  });

  it("the journey's diagnostics are debug lines: board deal, pinned pack read, pack validation, chain visibility", async () => {
    const { sink, logger } = debugSink();
    const { ids, requestIds } = await runJourney(makeApi(logger));

    expect(lineWith(sink, "board dealt", requestIds.toRound1)).toMatchObject({
      level: "debug",
      sessionId: ids.sessionId,
      roundNumber: 1,
      seed: "log-test-seed",
      rows: 3,
      cols: 3,
    });
    expect(lineWith(sink, "session pack loaded", requestIds.submit)).toMatchObject({
      level: "debug",
      packId: "log-test-pack",
      packVersion: "1.0.0",
      fellBackToLatest: false,
    });
    expect(lineWith(sink, "pack validated", requestIds.register)).toMatchObject({
      level: "debug",
      packId: "log-test-pack",
      errorCount: 0,
    });
    expect(lineWith(sink, "chain visibility applied", requestIds.list)).toMatchObject({
      level: "debug",
      sessionId: ids.sessionId,
      roundNumber: 1,
      viewer: "instructor",
      count: 1,
    });
  });

  it("five wrong passwords log each failure and then the lock; a further attempt is a warn", async () => {
    const { sink, logger } = debugSink();
    const api = makeApi(logger);
    const password = `pw-${randomBytes(8).toString("hex")}`;
    const signUp = await api.call(api.signUp, "POST", ROUTES.signUp, {
      body: { email: EMAIL, password },
    });
    const accountId = signUp.json.accountId as string;

    const attempts = [];
    for (let i = 0; i < 5; i++) {
      attempts.push(await api.call(api.signIn, "POST", ROUTES.signIn, {
        body: { email: EMAIL, password: `wrong-${i}` },
      }));
    }
    expect(attempts.at(-1)!.status).toBe(423);

    const wrong = sink.lines().filter(line => line.msg === "sign-in wrong password");
    expect(wrong.map(line => [line.requestId, line.failedCount])).toEqual(
      attempts.map((attempt, index) => [attempt.requestId, index + 1]),
    );
    expect(wrong.every(line => line.level === "info" && line.accountId === accountId)).toBe(true);
    const locked = lineWith(sink, "instructor account locked", attempts.at(-1)!.requestId);
    expect(locked).toMatchObject({ level: "info", accountId });
    expect(typeof locked!.lockedUntil).toBe("string");

    const refused = await api.call(api.signIn, "POST", ROUTES.signIn, {
      body: { email: EMAIL, password },
    });
    expect(refused.status).toBe(423);
    expect(lineWith(sink, "sign-in refused: account locked", refused.requestId)).toMatchObject({
      level: "warn",
      accountId,
      lockedUntil: locked!.lockedUntil,
    });

    api.clock.advanceSeconds(16 * 60);
    const signIn = await api.call(api.signIn, "POST", ROUTES.signIn, {
      body: { email: EMAIL, password },
    });
    expect(signIn.status).toBe(200);
    expect(lineWith(sink, "instructor signed in", signIn.requestId)).toMatchObject({ level: "info", accountId });
  });

  it("a token signed for another kind is refused with one warn line naming the claimed kind", async () => {
    const { sink, logger } = debugSink();
    const api = makeApi(logger);
    const { secrets } = await runJourney(api);

    const refused = await api.call(api.registerPack, "POST", ROUTES.packs, {
      body: minimalPack(),
      token: secrets.instructorToken,
    });

    expect(refused.status).toBe(401);
    expect(lineWith(sink, "bearer token refused", refused.requestId)).toMatchObject({
      level: "warn",
      scheme: "AccountAuth",
      claimedKind: "capability",
    });
    expect(sink.raw).not.toContain(secrets.instructorToken);
  });

  it("a body that breaks the request schema logs the field and reason at debug", async () => {
    const { sink, logger } = debugSink();
    const api = makeApi(logger);

    const refused = await api.call(api.signUp, "POST", ROUTES.signUp, {
      body: { email: EMAIL },
    });

    expect(refused.status).toBe(400);
    expect(lineWith(sink, "request body rejected", refused.requestId)).toMatchObject({
      level: "debug",
      field: "password",
      reason: "is required",
    });
    expect(sink.raw).not.toContain(EMAIL);
  });

  it("none of the journey's lines contains an email, token, password, hash or body text", async () => {
    const { sink, logger } = debugSink();
    const api = makeApi(logger);
    const { secrets } = await runJourney(api);
    // A wrong password and a refused token too, so the failure paths are covered.
    await api.call(api.signIn, "POST", ROUTES.signIn, {
      body: {
        email: EMAIL,
        password: secrets.password.toUpperCase(),
      },
    });
    await api.call(api.registerPack, "POST", ROUTES.packs, {
      body: minimalPack(),
      token: secrets.participantToken,
    });

    expect(sink.lines().length).toBeGreaterThan(20);
    expect(leakedSecrets(sink.raw, secrets)).toEqual([]);
    expect(sink.raw).not.toContain(secrets.password.toUpperCase());
  });

  it("the secret check bites: the same journey secrets are found when a line does carry them", async () => {
    const { sink, logger } = debugSink();
    const { secrets } = await runJourney(makeApi(logger));

    logger.info({ note: secrets.narrative, who: secrets.displayName, mail: EMAIL }, "careless line");

    expect(leakedSecrets(sink.raw, secrets)).toHaveLength(3);
  });
});

describe("write-conflict retries log at debug, which LOG_LEVEL=info drops (structured-logging ticket 06)", () => {
  /** Loses the race on the first save of each request, then saves normally. */
  class ConflictOnceRepository extends InMemoryGameSessionRepository {
    #conflictNext = true;

    public override async update(session: GameSession): Promise<void> {
      if (this.#conflictNext) {
        this.#conflictNext = false;
        throw new ConcurrentUpdateConflictError(session.sessionId.value, session.version);
      }
      await super.update(session);
    }
  }

  async function joinAfterOneConflict(logger: LoggerPort) {
    const session = GameSession.create({ packId: "diabe-teach", mode: "classroom", adjudicationMode: "peer-instructor" });
    const sessionRepo = new ConflictOnceRepository([session]);
    const join = wrapLambdaHandler(createJoinSessionHandler({
      sessionRepo,
      tokenSigner: new HmacCapabilityTokenAdapter(randomBytes(32).toString("hex")),
    }) as unknown as LambdaHandler, { path: ROUTES.join }, { logger });

    const response = await join(
      new Request(`http://localhost:8888${ROUTES.join}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: session.roomCode.value, displayName: "Alice" }),
      }),
      { params: {}, requestId: "req-conflict", ip: "127.0.0.1" } as unknown as Context,
    );
    expect(response.status).toBe(200);
    return session.sessionId.value;
  }

  function loggerAt(level: string, sink: InMemoryLogSink): LoggerPort {
    return AppRuntime.buildLogger(AppRuntime.loadEnvConfig({ LOG_LEVEL: level }, { yamlFilePath: false }), { destination: sink });
  }

  it("at LOG_LEVEL=debug, a retried write logs the session and attempt with the requestId", async () => {
    const sink = new InMemoryLogSink();
    const sessionId = await joinAfterOneConflict(loggerAt("debug", sink));

    expect(lineWith(sink, "session write conflict; retrying")).toMatchObject({
      level: "debug",
      requestId: "req-conflict",
      sessionId,
      attempt: 2,
    });
    expect(lineWith(sink, "learner joined", "req-conflict")).toBeDefined();
  });

  it("at LOG_LEVEL=info, the retry and board-deal debug lines disappear and the info lines stay", async () => {
    const sink = new InMemoryLogSink();
    await joinAfterOneConflict(loggerAt("info", sink));
    await runJourney(makeApi(loggerAt("info", sink)));

    const lines = sink.lines();
    expect(lines.filter(line => line.level === "debug")).toEqual([]);
    expect(lines.some(line => line.msg === "session write conflict; retrying")).toBe(false);
    expect(lines.some(line => line.msg === "board dealt")).toBe(false);
    expect(lines.some(line => line.msg === "learner joined")).toBe(true);
    expect(lines.some(line => line.msg === "chain submitted")).toBe(true);
  });
});
