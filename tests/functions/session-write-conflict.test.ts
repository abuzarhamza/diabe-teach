import type { APIGatewayProxyEvent } from "aws-lambda";
import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import type { RoomCode } from "../../src/domain/game-session/room-code.js";
import type { SessionId } from "../../src/domain/game-session/session-id.js";
import { describe, expect, it } from "vitest";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

/**
 * Wraps the in-memory repository and counts loads and save attempts, so a
 * test can tell whether a request was retried.
 */
class CountingSessionRepository implements GameSessionRepositoryPort {
  public loads = 0;
  public saveAttempts = 0;
  protected readonly inner: InMemoryGameSessionRepository;

  public constructor(inner: InMemoryGameSessionRepository) {
    this.inner = inner;
  }

  public async create(session: GameSession): Promise<void> {
    await this.inner.create(session);
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    this.loads++;
    return this.inner.findById(sessionId);
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    return this.inner.findByRoomCode(roomCode);
  }

  public async update(session: GameSession): Promise<void> {
    this.saveAttempts++;
    await this.save(session);
  }

  protected async save(session: GameSession): Promise<void> {
    await this.inner.update(session);
  }
}

/**
 * Every save loses the race: it reports the conflict the real repositories
 * raise when another write got there first.
 */
class AlwaysConflictingSessionRepository extends CountingSessionRepository {
  protected override async save(session: GameSession): Promise<void> {
    throw new ConcurrentUpdateConflictError(session.sessionId.value, session.version);
  }
}

/**
 * Runs a scripted competing request just before the first save, so that save
 * finds the stored session already changed. Later saves go straight through,
 * including the competing request's own save.
 */
class RaceBeforeFirstSaveSessionRepository extends CountingSessionRepository {
  #competingRequest: (() => Promise<void>) | null = null;

  public raceWith(competingRequest: () => Promise<void>): void {
    this.#competingRequest = competingRequest;
  }

  protected override async save(session: GameSession): Promise<void> {
    const competingRequest = this.#competingRequest;
    this.#competingRequest = null;
    if (competingRequest) {
      await competingRequest();
    }
    await super.save(session);
  }
}

const CHAIN_BODY = {
  path: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ],
  keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
  narrativeExplanation: "These concepts connect because...",
};

function makeChainEvent(sessionId: string, token: string, body: object = CHAIN_BODY): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/rounds/1/chains`,
    headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
    queryStringParameters: null,
    pathParameters: { sessionId, roundNumber: "1" },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

function makeAdvancePhaseEvent(sessionId: string, token: string): APIGatewayProxyEvent {
  return {
    ...makeChainEvent(sessionId, token, { action: "advance" }),
    path: `/api/v1/sessions/${sessionId}/phase`,
    pathParameters: { sessionId },
  };
}

/** A session in Round 1 Chain-Mapping with no deadline, and two participants. */
async function setUpChainMappingSession() {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    timerConfig: { roundMappingSec: null },
  });
  session.transitionTo("trial-orientation", new Date());
  session.transitionTo("round-1:chain-mapping", new Date());
  const alice = session.addParticipant("Alice");
  const bob = session.addParticipant("Bob");
  const sessionId = session.sessionId.value;
  const store = new InMemoryGameSessionRepository([session]);
  const tokenAdapter = new FakeCapabilityTokenAdapter();

  return {
    session,
    sessionId,
    store,
    tokenAdapter,
    alice,
    bob,
    aliceToken: await tokenAdapter.signToken({ role: "participant", sessionId, participantId: alice.participantId }),
    bobToken: await tokenAdapter.signToken({ role: "participant", sessionId, participantId: bob.participantId }),
    instructorToken: await tokenAdapter.signToken({ role: "instructor", sessionId }),
  };
}

describe("session writes that lose a concurrent-update race", () => {
  it("rejects a chain that raced the instructor ending Chain-Mapping, and keeps the new phase", async () => {
    const { session, sessionId, store, tokenAdapter, aliceToken, instructorToken } = await setUpChainMappingSession();
    const sessionRepo = new RaceBeforeFirstSaveSessionRepository(store);
    const submitChain = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    const transitionPhase = createTransitionPhaseHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    sessionRepo.raceWith(async () => {
      const transitioned = await transitionPhase(makeAdvancePhaseEvent(sessionId, instructorToken), {} as never);
      expect(transitioned.statusCode).toBe(200);
    });

    const response = await submitChain(makeChainEvent(sessionId, aliceToken), {} as never);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({ code: "PHASE_CLOSED_FOR_SUBMISSIONS" });
    const stored = await store.findById(session.sessionId);
    expect(stored?.currentPhase).toBe("round-1:peer-adjudication");
    expect(stored?.chains).toEqual([]);
  });

  it("records both of two chains submitted at the same moment", async () => {
    const { session, sessionId, store, tokenAdapter, alice, bob, aliceToken, bobToken } = await setUpChainMappingSession();
    const sessionRepo = new RaceBeforeFirstSaveSessionRepository(store);
    const submitChain = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    sessionRepo.raceWith(async () => {
      const bobsSubmission = await submitChain(makeChainEvent(sessionId, bobToken), {} as never);
      expect(bobsSubmission.statusCode).toBe(201);
    });

    const alicesSubmission = await submitChain(makeChainEvent(sessionId, aliceToken), {} as never);

    expect(alicesSubmission.statusCode).toBe(201);
    const stored = await store.findById(session.sessionId);
    expect(stored?.chains.map(chain => chain.participantId)).toEqual([bob.participantId, alice.participantId]);
  });

  it("records exactly one chain when one participant submits the same chain twice at the same moment", async () => {
    const { session, sessionId, store, tokenAdapter, alice, aliceToken } = await setUpChainMappingSession();
    const sessionRepo = new RaceBeforeFirstSaveSessionRepository(store);
    const submitChain = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    sessionRepo.raceWith(async () => {
      const competing = await submitChain(makeChainEvent(sessionId, aliceToken), {} as never);
      expect(competing.statusCode).toBe(201);
    });

    const retried = await submitChain(makeChainEvent(sessionId, aliceToken), {} as never);

    expect(retried.statusCode).toBe(409);
    expect(JSON.parse(retried.body)).toMatchObject({ code: "CHAIN_ALREADY_SUBMITTED" });
    const stored = await store.findById(session.sessionId);
    expect(stored?.chains.map(chain => chain.participantId)).toEqual([alice.participantId]);
  });

  it("does not retry a request rejected for a reason other than a conflict", async () => {
    const { sessionId, store, tokenAdapter, aliceToken } = await setUpChainMappingSession();
    const sessionRepo = new CountingSessionRepository(store);
    const handler = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });

    const response = await handler(makeChainEvent(sessionId, aliceToken, {
      ...CHAIN_BODY,
      path: CHAIN_BODY.path.slice(0, 2),
    }), {} as never);

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({ code: "CHAIN_TOPOLOGY_INVALID" });
    expect(sessionRepo.loads).toBe(1);
    expect(sessionRepo.saveAttempts).toBe(0);
  });

  it("returns 409 CONCURRENT_UPDATE_CONFLICT after exactly 3 save attempts, and records nothing", async () => {
    const { session, sessionId, store, tokenAdapter, aliceToken } = await setUpChainMappingSession();
    const sessionRepo = new AlwaysConflictingSessionRepository(store);
    const handler = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });

    const response = await handler(makeChainEvent(sessionId, aliceToken), {} as never);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({ code: "CONCURRENT_UPDATE_CONFLICT" });
    expect(sessionRepo.saveAttempts).toBe(3);
    expect((await store.findById(session.sessionId))?.chains).toEqual([]);
  });
});
