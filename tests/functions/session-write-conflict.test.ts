import type { APIGatewayProxyEvent } from "aws-lambda";
import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import type { RoomCode } from "../../src/domain/game-session/room-code.js";
import type { SessionId } from "../../src/domain/game-session/session-id.js";
import { describe, expect, it } from "vitest";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { ConcurrentUpdateConflictError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

/**
 * Wraps the in-memory repository, but every save loses the race: it reports
 * the conflict the real repositories raise when another write got there first.
 */
class AlwaysConflictingSessionRepository implements GameSessionRepositoryPort {
  readonly #inner: InMemoryGameSessionRepository;

  public constructor(inner: InMemoryGameSessionRepository) {
    this.#inner = inner;
  }

  public async create(session: GameSession): Promise<void> {
    await this.#inner.create(session);
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    return this.#inner.findById(sessionId);
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    return this.#inner.findByRoomCode(roomCode);
  }

  public async update(session: GameSession): Promise<void> {
    throw new ConcurrentUpdateConflictError(session.sessionId.value, session.version);
  }
}

function makeChainEvent(sessionId: string, token: string, body: object): APIGatewayProxyEvent {
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

describe("session writes that lose a concurrent-update race", () => {
  it("returns 409 CONCURRENT_UPDATE_CONFLICT and records nothing", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      timerConfig: { roundMappingSec: null },
    });
    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    const participant = session.addParticipant("Alice");
    const store = new InMemoryGameSessionRepository([session]);
    const sessionRepo = new AlwaysConflictingSessionRepository(store);
    const tokenAdapter = new FakeCapabilityTokenAdapter();
    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });
    const handler = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });

    const response = await handler(makeChainEvent(session.sessionId.value, token, {
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
      narrativeExplanation: "These concepts connect because...",
    }), {} as never);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({ code: "CONCURRENT_UPDATE_CONFLICT" });
    expect((await store.findById(session.sessionId))?.chains).toEqual([]);
  });
});
