import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import type { GameSession } from "../../src/domain/game-session/game-session.js";
import type { RoomCode } from "../../src/domain/game-session/room-code.js";
import type { SessionId } from "../../src/domain/game-session/session-id.js";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { CryptoBoardSeedGenerator } from "../../src/adapters/outbound/crypto-board-seed-generator.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { FakeWriteConflictBackoff } from "../../src/adapters/outbound/fake-write-conflict-backoff.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { PinoLogger } from "../../src/adapters/outbound/pino-logger.js";
import { SeedrandomSeededRandom } from "../../src/adapters/outbound/seedrandom-seeded-random.js";
import { TimerWriteConflictBackoff } from "../../src/adapters/outbound/timer-write-conflict-backoff.js";
import { GameSessionUpdateRetrier } from "../../src/application/services/game-session-update-retrier.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { SessionId as SessionIdVo } from "../../src/domain/game-session/session-id.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";

type LambdaHandler = (event: APIGatewayProxyEvent, context: LambdaContext) => Promise<APIGatewayProxyResult>;

/**
 * Fault-injecting GameSessionRepositoryPort decorator that can:
 * 1. Throw a credentialed MongoNetworkError on demand.
 * 2. Inject N synthetic ConcurrentUpdateConflictErrors before delegating to the real repository.
 * 3. Simulate a slight async interleaving delay during concurrent update stampedes so concurrent
 *    loads overlap and exercise GameSessionUpdateRetrier's optimistic concurrency loop.
 */
class FaultInjectingGameSessionRepository implements GameSessionRepositoryPort {
  readonly #inner: InMemoryGameSessionRepository;
  #networkErrorToThrow: Error | null = null;
  #remainingConflictCount = 0;
  #simulateAsyncOverlap = false;

  public constructor(inner = new InMemoryGameSessionRepository()) {
    this.#inner = inner;
  }

  public injectNetworkErrorOnce(error: Error): void {
    this.#networkErrorToThrow = error;
  }

  public injectWriteConflicts(count: number): void {
    this.#remainingConflictCount = count;
  }

  public setSimulateAsyncOverlap(enabled: boolean): void {
    this.#simulateAsyncOverlap = enabled;
  }

  public async create(session: GameSession): Promise<void> {
    this.#consumeNetworkErrorIfSet();
    await this.#inner.create(session);
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    this.#consumeNetworkErrorIfSet();
    if (this.#simulateAsyncOverlap) {
      await new Promise(resolve => setImmediate(resolve));
    }
    return this.#inner.findById(sessionId);
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    this.#consumeNetworkErrorIfSet();
    if (this.#simulateAsyncOverlap) {
      await new Promise(resolve => setImmediate(resolve));
    }
    return this.#inner.findByRoomCode(roomCode);
  }

  public async update(session: GameSession): Promise<void> {
    this.#consumeNetworkErrorIfSet();
    if (this.#remainingConflictCount > 0) {
      this.#remainingConflictCount--;
      // Bump underlying stored version externally to mimic a competing writer winning the race
      const latest = await this.#inner.findById(session.sessionId);
      if (latest) {
        await this.#inner.update(latest);
      }
      throw new ConcurrentUpdateConflictError(session.sessionId.value, session.version);
    }
    await this.#inner.update(session);
  }

  #consumeNetworkErrorIfSet(): void {
    if (this.#networkErrorToThrow) {
      const err = this.#networkErrorToThrow;
      this.#networkErrorToThrow = null;
      throw err;
    }
  }
}

describe("chaos / Fault-Injection & Concurrency Stampede Suite", () => {
  const clock = new FakeClock(new Date("2026-04-01T10:00:00.000Z"));
  const capabilityTokens = HmacCapabilityTokenAdapter.fromSecret(randomBytes(32).toString("hex"))!;
  const accountTokens = HmacAccountTokenAdapter.fromSecret(randomBytes(32).toString("hex"), clock)!;
  const seededRandom = new SeedrandomSeededRandom();
  const seedGenerator = new CryptoBoardSeedGenerator();

  it("sanitizes credentialed MongoDB errors in structured logs and returns a generic 500 INTERNAL_ERROR without leaking URIs or stacks", async () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "debug", destination: sink });
    const faultySessionRepo = new FaultInjectingGameSessionRepository();

    const getSessionRoute = wrapLambdaHandler(
      createGetSessionHandler({
        sessionRepo: faultySessionRepo,
        tokenVerifier: capabilityTokens,
      }) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/:sessionId" },
      { logger },
    );

    const sessionId = "sess-chaos-500";
    const instructorToken = await capabilityTokens.signToken({
      role: "instructor",
      sessionId,
    });

    const mongoDrop = new Error(
      "MongoNetworkError: failed to connect to mongodb+srv://admin:SuperSecretPass99@cluster0.example.mongodb.net/diabe_teach?retryWrites=true",
    );
    mongoDrop.name = "MongoNetworkError";
    faultySessionRepo.injectNetworkErrorOnce(mongoDrop);

    const res = await getSessionRoute(
      new Request(`http://localhost:8888/api/v1/sessions/${sessionId}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${instructorToken}`,
        },
      }),
      { params: {}, requestId: "req-chaos-mongo-drop-1", ip: "127.0.0.1" } as unknown as Context,
    );

    expect(res.status).toBe(500);
    const rawBody = await res.text();
    expect(rawBody).not.toContain("SuperSecretPass99");
    expect(rawBody).not.toContain("mongodb+srv://");
    expect(rawBody).not.toContain("cluster0.example.mongodb.net");
    expect(rawBody).not.toContain("MongoNetworkError");
    expect(rawBody).not.toMatch(/\bat \S+ \(/); // no stack frames
    expect(rawBody).not.toContain("stack");

    const parsedBody = JSON.parse(rawBody) as { code: string; message: string };
    expect(parsedBody).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });

    // Verify structured log output in InMemoryLogSink stripped credentials but kept host and requestId
    expect(sink.raw).not.toContain("SuperSecretPass99");
    expect(sink.raw).not.toContain("admin:SuperSecretPass99@");
    // MongoCredentialStripper removes the whole `user:pass@` userinfo (no placeholder) and keeps the host.
    expect(sink.raw).toContain("mongodb+srv://cluster0.example.mongodb.net/diabe_teach");

    const errorLines = sink.lines().filter(l => l.level === "error");
    expect(errorLines.length).toBeGreaterThanOrEqual(2);
    expect(errorLines[0]).toMatchObject({
      level: "error",
      requestId: "req-chaos-mongo-drop-1",
      route: "/api/v1/sessions/:sessionId",
      method: "GET",
      msg: "unhandled error in API handler",
    });
    for (const line of errorLines) {
      expect(line.requestId).toBe("req-chaos-mongo-drop-1");
    }
  });

  it(`recovers transparently from 1 and 2 consecutive optimistic-concurrency conflicts and fails closed with 409 after ${GameSessionUpdateRetrier.MAX_ATTEMPTS} conflicts`, async () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "debug", destination: sink });
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const faultySessionRepo = new FaultInjectingGameSessionRepository();
    const backoff = new FakeWriteConflictBackoff(0.5);

    const deps = {
      packRepo,
      sessionRepo: faultySessionRepo,
      writeConflictBackoff: backoff,
      tokenSigner: capabilityTokens,
      tokenVerifier: capabilityTokens,
      accountTokenVerifier: accountTokens,
      clock,
      seededRandom,
      seedGenerator,
    };

    const createSessionRoute = wrapLambdaHandler(
      createCreateSessionHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions" },
      { logger },
    );
    const joinSessionRoute = wrapLambdaHandler(
      createJoinSessionHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/join" },
      { logger },
    );

    const accountToken = (
      await accountTokens.signAccountToken(
        { accountId: "acc-chaos-1", email: "chaos.teacher@aku.edu" },
        clock.now(),
      )
    ).token;

    const createRes = await createSessionRoute(
      new Request("http://localhost:8888/api/v1/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${accountToken}`,
        },
        body: JSON.stringify({
          packId: "diabe-teach",
          mode: "classroom",
          adjudicationMode: "peer-instructor",
        }),
      }),
      { params: {}, requestId: "req-chaos-create", ip: "127.0.0.1" } as unknown as Context,
    );
    expect(createRes.status).toBe(201);
    const { sessionId, roomCode } = (await createRes.json()) as { sessionId: string; roomCode: string };

    // 1. 1 conflict -> recovers on attempt 2
    faultySessionRepo.injectWriteConflicts(1);
    const join1Res = await joinSessionRoute(
      new Request("http://localhost:8888/api/v1/sessions/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode, displayName: "Retry Learner 1" }),
      }),
      { params: {}, requestId: "req-chaos-retry-1", ip: "127.0.0.1" } as unknown as Context,
    );
    expect(join1Res.status).toBe(200);

    // 2. 2 consecutive conflicts -> recovers on attempt 3
    faultySessionRepo.injectWriteConflicts(2);
    const join2Res = await joinSessionRoute(
      new Request("http://localhost:8888/api/v1/sessions/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode, displayName: "Retry Learner 2" }),
      }),
      { params: {}, requestId: "req-chaos-retry-2", ip: "127.0.0.1" } as unknown as Context,
    );
    expect(join2Res.status).toBe(200);

    // Verify debug retry log lines were emitted
    const retryLogs = sink.lines().filter(l => l.msg === "session write conflict; retrying");
    expect(retryLogs.length).toBe(3); // 1 from join1 + 2 from join2
    for (const line of retryLogs) {
      expect(line.level).toBe("debug");
      expect(line.sessionId).toBe(sessionId);
    }
    expect(retryLogs.map(l => l.attempt)).toEqual([2, 2, 3]);
    // Each retry waited a jittered backoff first (half of each ceiling with the fake's 0.5 jitter).
    expect(retryLogs.map(l => l.delayMs)).toEqual([10, 10, 20]);
    expect(backoff.sleeps).toEqual([10, 10, 20]);

    const beforeExhaustion = (await faultySessionRepo.findById(SessionIdVo.from(sessionId)))!.toSnapshot();

    // 3. MAX_ATTEMPTS consecutive conflicts -> exhausts the retrier and fails closed with 409 CONCURRENT_UPDATE_CONFLICT
    const { MAX_ATTEMPTS } = GameSessionUpdateRetrier;
    faultySessionRepo.injectWriteConflicts(MAX_ATTEMPTS);
    const join3Res = await joinSessionRoute(
      new Request("http://localhost:8888/api/v1/sessions/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode, displayName: "Exhausted Learner 3" }),
      }),
      { params: {}, requestId: "req-chaos-retry-3", ip: "127.0.0.1" } as unknown as Context,
    );
    expect(join3Res.status).toBe(409);
    const conflictBody = (await join3Res.json()) as { code: string };
    expect(conflictBody.code).toBe("CONCURRENT_UPDATE_CONFLICT");

    // Stored session has only the 2 committed learners and was not corrupted by the failed 3rd join:
    // apart from the MAX_ATTEMPTS version bumps made by the simulated competing writer, the snapshot is unchanged.
    const stored = await faultySessionRepo.findById(SessionIdVo.from(sessionId));
    expect(stored?.participants.map(p => p.displayName)).toEqual([
      "Retry Learner 1",
      "Retry Learner 2",
    ]);
    const afterExhaustion = stored!.toSnapshot();
    expect(afterExhaustion.version).toBe(beforeExhaustion.version + MAX_ATTEMPTS);
    expect({ ...afterExhaustion, version: 0 }).toEqual({ ...beforeExhaustion, version: 0 });
  });

  it("handles a 25-learner concurrent classroom stampede (joins, Pretest assessments, and Round 1 chain submissions) with zero 409s and zero lost updates, without the client resending", async () => {
    const LEARNER_COUNT = 25;
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const sessionRepo = new InMemoryGameSessionRepository();
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "debug", destination: sink });
    // The production backoff policy with real timers; seeded jitter so the delays repeat run to run.
    const backoffRandom = seededRandom.forSeed("stampede-backoff");

    const deps = {
      packRepo,
      sessionRepo,
      writeConflictBackoff: new TimerWriteConflictBackoff(backoffRandom),
      tokenSigner: capabilityTokens,
      tokenVerifier: capabilityTokens,
      accountTokenVerifier: accountTokens,
      clock,
      seededRandom,
      seedGenerator,
    };

    const createSessionRoute = wrapLambdaHandler(
      createCreateSessionHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions" },
      { logger },
    );
    const joinSessionRoute = wrapLambdaHandler(
      createJoinSessionHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/join" },
      { logger },
    );
    const transitionPhaseRoute = wrapLambdaHandler(
      createTransitionPhaseHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/:sessionId/phase" },
      { logger },
    );
    const submitAssessmentRoute = wrapLambdaHandler(
      createSubmitAssessmentHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/:sessionId/assessments/:stage" },
      { logger },
    );
    const submitChainRoute = wrapLambdaHandler(
      createSubmitChainHandler(deps) as unknown as LambdaHandler,
      { path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains" },
      { logger },
    );

    const accountToken = (
      await accountTokens.signAccountToken(
        { accountId: "acc-stampede-1", email: "stampede.teacher@aku.edu" },
        clock.now(),
      )
    ).token;

    const createRes = await createSessionRoute(
      new Request("http://localhost:8888/api/v1/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${accountToken}`,
        },
        body: JSON.stringify({
          packId: "diabe-teach",
          mode: "classroom",
          adjudicationMode: "peer-instructor",
        }),
      }),
      { params: {}, requestId: "req-stampede-create", ip: "127.0.0.1" } as unknown as Context,
    );
    const { sessionId, roomCode, instructorToken } = (await createRes.json()) as {
      sessionId: string;
      roomCode: string;
      instructorToken: string;
    };

    // Wave 1: 25 learners join concurrently via Promise.all
    const joinResults = await Promise.all(
      Array.from({ length: LEARNER_COUNT }, (_, idx) =>
        joinSessionRoute(
          new Request("http://localhost:8888/api/v1/sessions/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              roomCode,
              displayName: `Stampede Learner ${idx + 1}`,
            }),
          }),
          { params: {}, requestId: `req-stampede-join-${idx + 1}`, ip: "127.0.0.1" } as unknown as Context,
        )),
    );
    // The stampede really contends, and the server's jittered retries absorb it: no learner sees a 409.
    expect(sink.lines().filter(l => l.msg === "session write conflict; retrying").length).toBeGreaterThan(0);
    expect(joinResults.map(res => res.status)).toEqual(Array.from({ length: LEARNER_COUNT }).fill(200));

    // Every join committed exactly once: the stored participants are exactly the 25 acknowledged joins.
    const afterJoins = await sessionRepo.findById(SessionIdVo.from(sessionId));
    expect(afterJoins!.participantCount).toBe(LEARNER_COUNT);
    expect(afterJoins!.version).toBe(LEARNER_COUNT);

    const learners: Array<{ participantId: string; participantToken: string }> = [];
    for (const res of joinResults) {
      const body = (await res.json()) as { participantId: string; participantToken: string };
      learners.push(body);
    }
    expect(new Set(learners.map(l => l.participantId)).size).toBe(LEARNER_COUNT);
    expect(new Set(afterJoins!.participants.map(p => p.participantId))).toEqual(
      new Set(learners.map(l => l.participantId)),
    );

    // Wave 2: All 25 learners submit Pretest assessment concurrently
    const validPretestAnswers = Object.fromEntries(
      (DIABE_TEACH_PACK.assessmentInstrument?.questions ?? []).map((q, i) => [q.id, (i % 4) as 0 | 1 | 2 | 3]),
    );

    const pretestResults = await Promise.all(
      learners.map((learner, idx) =>
        submitAssessmentRoute(
          new Request(`http://localhost:8888/api/v1/sessions/${sessionId}/assessments/pretest`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": `Bearer ${learner.participantToken}`,
            },
            body: JSON.stringify({ answers: validPretestAnswers }),
          }),
          { params: {}, requestId: `req-stampede-pretest-${idx + 1}`, ip: "127.0.0.1" } as unknown as Context,
        )),
    );
    expect(pretestResults.map(res => res.status)).toEqual(Array.from({ length: LEARNER_COUNT }).fill(201));
    const afterPretests = await sessionRepo.findById(SessionIdVo.from(sessionId));
    expect(afterPretests!.assessmentAttempts.length).toBe(LEARNER_COUNT);
    expect(afterPretests!.version).toBe(LEARNER_COUNT * 2);

    // Advance session from pretest -> trial-orientation -> round-1:chain-mapping
    for (const seed of [undefined, "stampede-r1-seed"]) {
      const transRes = await transitionPhaseRoute(
        new Request(`http://localhost:8888/api/v1/sessions/${sessionId}/phase`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${instructorToken}`,
          },
          body: JSON.stringify(seed
            ? { action: "advance", seed }
            : { action: "advance" }),
        }),
        { params: {}, requestId: "req-stampede-phase", ip: "127.0.0.1" } as unknown as Context,
      );
      expect(transRes.status).toBe(200);
    }

    // Wave 3: All 25 learners submit a Round 1 Concept Chain concurrently
    const chainResults = await Promise.all(
      learners.map((learner, idx) => {
        const row = idx % 7;
        return submitChainRoute(
          new Request(`http://localhost:8888/api/v1/sessions/${sessionId}/rounds/1/chains`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": `Bearer ${learner.participantToken}`,
            },
            body: JSON.stringify({
              path: [
                { row, col: 0 },
                { row, col: 1 },
                { row, col: 2 },
                { row, col: 3 },
              ],
              narrativeExplanation: `Stampede chain from learner ${idx + 1}`,
            }),
          }),
          { params: {}, requestId: `req-stampede-chain-${idx + 1}`, ip: "127.0.0.1" } as unknown as Context,
        );
      }),
    );
    expect(chainResults.map(res => res.status)).toEqual(Array.from({ length: LEARNER_COUNT }).fill(201));

    // Final invariant verification on the stored aggregate
    const finalSession = await sessionRepo.findById(SessionIdVo.from(sessionId));
    expect(finalSession).not.toBeNull();
    expect(finalSession!.participantCount).toBe(LEARNER_COUNT);
    expect(finalSession!.participants.length).toBe(LEARNER_COUNT);
    expect(finalSession!.assessmentAttempts.length).toBe(LEARNER_COUNT);
    expect(finalSession!.getChainsForRound(1).length).toBe(LEARNER_COUNT);
    expect(new Set(finalSession!.getChainsForRound(1).map(c => c.participantId))).toEqual(
      new Set(learners.map(l => l.participantId)),
    );
    expect(new Set(finalSession!.assessmentAttempts.map(a => a.participantId))).toEqual(
      new Set(learners.map(l => l.participantId)),
    );
    // Every committed write bumps the version exactly once:
    // 25 joins + 25 pretests + 2 phase transitions + 25 chains = 77 atomic updates
    expect(finalSession!.version).toBe(25 + 25 + 2 + 25);
  });
});
