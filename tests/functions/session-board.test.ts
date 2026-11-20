import type { APIGatewayProxyEvent } from "aws-lambda";
import type { BoardSeedGeneratorPort } from "../../src/application/ports/board-randomness.port.js";
import type { GameSessionRepositoryPort } from "../../src/application/ports/game-session-repository.port.js";
import type { GameSession } from "../../src/domain/game-session/game-session.js";
import type { RoomCode } from "../../src/domain/game-session/room-code.js";
import type { SessionId } from "../../src/domain/game-session/session-id.js";
import { describe, expect, it } from "vitest";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { GameSession as GameSessionAggregate } from "../../src/domain/game-session/game-session.js";
import { SessionId as SessionIdValue } from "../../src/domain/game-session/session-id.js";
import { createSignedInCreateSessionHandler } from "./support/signed-in-teacher.js";

interface BoardCellView {
  readonly row: number;
  readonly col: number;
  readonly card: { readonly id: string; readonly displayLabel: string };
}

interface BoardGridView {
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly (readonly BoardCellView[])[];
}

/** Hands out "generated-1", "generated-2", ... and counts the calls. */
class CountingSeedGenerator implements BoardSeedGeneratorPort {
  public calls = 0;

  public nextSeed(): string {
    this.calls++;
    return `generated-${this.calls}`;
  }
}

/**
 * Runs a competing request (a participant joining) just before the first
 * save, so that save loses the race and the request is retried.
 */
class RaceBeforeFirstSaveSessionRepository implements GameSessionRepositoryPort {
  public saveAttempts = 0;
  #competingRequest: (() => Promise<void>) | null = null;
  readonly #inner: InMemoryGameSessionRepository;

  public constructor(inner: InMemoryGameSessionRepository) {
    this.#inner = inner;
  }

  public raceWith(competingRequest: () => Promise<void>): void {
    this.#competingRequest = competingRequest;
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
    this.saveAttempts++;
    const competingRequest = this.#competingRequest;
    this.#competingRequest = null;
    if (competingRequest) {
      await competingRequest();
    }
    await this.#inner.update(session);
  }
}

function makeEvent(
  method: string,
  path: string,
  options: {
    body?: object;
    pathParameters?: Record<string, string>;
    token?: string;
  } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "content-type": "application/json",
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

function makeHandlers(options: {
  sessionRepo?: GameSessionRepositoryPort;
  seedGenerator?: BoardSeedGeneratorPort;
} = {}) {
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const sessionRepo = options.sessionRepo ?? new InMemoryGameSessionRepository();
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const seedGenerator = options.seedGenerator ?? new CountingSeedGenerator();

  return {
    create: createSignedInCreateSessionHandler({ packRepo, sessionRepo, tokenSigner: tokenAdapter }),
    join: createJoinSessionHandler({ sessionRepo, tokenSigner: tokenAdapter }),
    get: createGetSessionHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    submit: createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter }),
    transition: createTransitionPhaseHandler({
      packRepo,
      sessionRepo,
      tokenVerifier: tokenAdapter,
      seedGenerator,
    }),
  };
}

type Handlers = ReturnType<typeof makeHandlers>;

/** Creates a classroom session and returns helpers to drive it. */
async function createSession(handlers: Handlers, seed?: string) {
  const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
    body: {
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      ...(seed !== undefined && { seed }),
    },
  }));
  expect(created.statusCode).toBe(201);
  const { sessionId, roomCode, instructorToken } = created.body as {
    sessionId: string;
    roomCode: string;
    instructorToken: string;
  };

  const transition = async (body: object = { action: "advance" }) => {
    const response = await invoke(handlers.transition, makeEvent("POST", `/api/v1/sessions/${sessionId}/phase`, {
      body,
      pathParameters: { sessionId },
      token: instructorToken,
    }));
    expect(response.statusCode).toBe(200);
    return response.body.state as { currentPhase: string; activeBoard: BoardGridView | null };
  };

  /** Advances until the session is in `phase`, returning that response's state. */
  const advanceTo = async (phase: string) => {
    for (let step = 0; step < 12; step++) {
      const state = await transition();
      if (state.currentPhase === phase) {
        return state;
      }
    }
    throw new Error(`Never reached phase '${phase}'.`);
  };

  return {
    created: created.body,
    sessionId,
    roomCode,
    instructorToken,
    transition,
    advanceTo,
  };
}

function cardIds(board: BoardGridView | null): string[][] {
  expect(board).not.toBeNull();
  return board!.cells.map(row => row.map(cell => cell.card.id));
}

describe("server-dealt round board (activeBoard)", () => {
  it("deals round 1 as a rows × cols grid of distinct pack cards, carrying the creation seed", async () => {
    const handlers = makeHandlers();
    const session = await createSession(handlers, "classroom-42");

    const state = await session.advanceTo("round-1:chain-mapping");

    const board = state.activeBoard!;
    const { rows, cols } = DIABE_TEACH_PACK.boardConfig;
    expect(board.seed).toBe("classroom-42");
    expect(board.rows).toBe(rows);
    expect(board.cols).toBe(cols);
    expect(board.cells).toHaveLength(rows);
    board.cells.forEach((row, rowIndex) => {
      expect(row).toHaveLength(cols);
      row.forEach((cell, colIndex) => {
        expect(cell.row).toBe(rowIndex);
        expect(cell.col).toBe(colIndex);
        const packCard = DIABE_TEACH_PACK.cards.find(card => card.id === cell.card.id);
        expect(packCard).toBeDefined();
        expect(cell.card).toEqual(packCard);
      });
    });
    const ids = cardIds(board).flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives two sessions with the same pack and seed the same round 1 board, and different seeds different boards", async () => {
    const handlers = makeHandlers();
    const first = await createSession(handlers, "same-seed");
    const second = await createSession(handlers, "same-seed");
    const other = await createSession(handlers, "other-seed");

    const firstBoard = (await first.advanceTo("round-1:chain-mapping")).activeBoard;
    const secondBoard = (await second.advanceTo("round-1:chain-mapping")).activeBoard;
    const otherBoard = (await other.advanceTo("round-1:chain-mapping")).activeBoard;

    expect(secondBoard).toEqual(firstBoard);
    expect(cardIds(otherBoard)).not.toEqual(cardIds(firstBoard));
  });

  it("returns a null board outside the rounds and the same board through one round's phases", async () => {
    const handlers = makeHandlers();
    const session = await createSession(handlers, "steady");
    expect(session.created.state.activeBoard).toBeNull();

    const orientation = await session.transition();
    expect(orientation.currentPhase).toBe("trial-orientation");
    expect(orientation.activeBoard).toBeNull();

    const mapping = await session.transition();
    const adjudication = await session.transition();
    const summary = await session.transition();
    expect(adjudication.currentPhase).toBe("round-1:peer-adjudication");
    expect(summary.currentPhase).toBe("round-1:round-summary");
    expect(mapping.activeBoard).not.toBeNull();
    expect(adjudication.activeBoard).toEqual(mapping.activeBoard);
    expect(summary.activeBoard).toEqual(mapping.activeBoard);

    const posttest = await session.advanceTo("posttest");
    expect(posttest.activeBoard).toBeNull();
  });

  it("deals round 2 a fresh board with its own generated seed", async () => {
    const seedGenerator = new CountingSeedGenerator();
    const handlers = makeHandlers({ seedGenerator });
    const session = await createSession(handlers, "round-one-seed");

    const round1 = await session.advanceTo("round-1:chain-mapping");
    const round2 = await session.advanceTo("round-2:chain-mapping");

    expect(round1.activeBoard!.seed).toBe("round-one-seed");
    expect(round2.activeBoard!.seed).toBe("generated-1");
    expect(seedGenerator.calls).toBe(1);
    expect(cardIds(round2.activeBoard)).not.toEqual(cardIds(round1.activeBoard));
  });

  it("generates a round 1 seed when none was given at creation", async () => {
    const seedGenerator = new CountingSeedGenerator();
    const handlers = makeHandlers({ seedGenerator });
    const session = await createSession(handlers);

    const round1 = await session.advanceTo("round-1:chain-mapping");

    expect(round1.activeBoard!.seed).toBe("generated-1");
  });

  it("reproduces a known board from a transition seed, which overrides the creation seed", async () => {
    const handlers = makeHandlers();
    const known = await createSession(handlers, "known-board");
    const knownBoard = (await known.advanceTo("round-1:chain-mapping")).activeBoard;

    const replay = await createSession(handlers, "ignored-for-round-1");
    await replay.advanceTo("trial-orientation");
    const replayRound1 = await replay.transition({ action: "advance", seed: "known-board" });
    expect(replayRound1.activeBoard).toEqual(knownBoard);

    await replay.advanceTo("round-1:round-summary");
    const replayRound2 = await replay.transition({ action: "jump", targetPhase: "round-2:chain-mapping", seed: "known-board" });
    expect(replayRound2.currentPhase).toBe("round-2:chain-mapping");
    expect(replayRound2.activeBoard).toEqual(knownBoard);
  });

  it("returns the same board from get-state and join as from the transition", async () => {
    const handlers = makeHandlers();
    const session = await createSession(handlers, "shared");
    const round1 = await session.advanceTo("round-1:chain-mapping");

    const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
      body: { roomCode: session.roomCode, displayName: "Alice" },
    }));
    const instructorView = await invoke(handlers.get, makeEvent("GET", `/api/v1/sessions/${session.sessionId}`, {
      pathParameters: { sessionId: session.sessionId },
      token: session.instructorToken,
    }));
    const participantView = await invoke(handlers.get, makeEvent("GET", `/api/v1/sessions/${session.sessionId}`, {
      pathParameters: { sessionId: session.sessionId },
      token: joined.body.participantToken,
    }));

    expect(joined.statusCode).toBe(200);
    expect(joined.body.state.activeBoard).toEqual(round1.activeBoard);
    expect(instructorView.body.state.activeBoard).toEqual(round1.activeBoard);
    expect(participantView.body.state.activeBoard).toEqual(round1.activeBoard);
  });

  it("deals the same board when a transition is retried after a write conflict", async () => {
    const seedGenerator = new CountingSeedGenerator();
    const sessionRepo = new RaceBeforeFirstSaveSessionRepository(new InMemoryGameSessionRepository());
    const handlers = makeHandlers({ sessionRepo, seedGenerator });
    const session = await createSession(handlers);
    await session.advanceTo("trial-orientation");
    sessionRepo.raceWith(async () => {
      const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
        body: { roomCode: session.roomCode, displayName: "Late Alice" },
      }));
      expect(joined.statusCode).toBe(200);
    });
    const attemptsBefore = sessionRepo.saveAttempts;

    const round1 = await session.transition();

    // The transition's first save lost to the join and was retried.
    expect(sessionRepo.saveAttempts - attemptsBefore).toBe(3);
    expect(seedGenerator.calls).toBe(1);
    expect(round1.activeBoard!.seed).toBe("generated-1");
    const reference = await createSession(makeHandlers(), "generated-1");
    expect(round1.activeBoard).toEqual((await reference.advanceTo("round-1:chain-mapping")).activeBoard);
    const stored = await invoke(handlers.get, makeEvent("GET", `/api/v1/sessions/${session.sessionId}`, {
      pathParameters: { sessionId: session.sessionId },
      token: session.instructorToken,
    }));
    expect(stored.body.state.participantCount).toBe(1);
    expect(stored.body.state.activeBoard).toEqual(round1.activeBoard);
  });

  it("rejects a non-string seed at creation and in a transition with 400", async () => {
    const handlers = makeHandlers();
    const created = await invoke(handlers.create, makeEvent("POST", "/api/v1/sessions", {
      body: {
        packId: "diabe-teach",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        seed: 42,
      },
    }));
    expect(created.statusCode).toBe(400);
    expect(created.body.code).toBe("INVALID_REQUEST_BODY");

    const session = await createSession(handlers);
    await session.advanceTo("trial-orientation");
    const transitioned = await invoke(handlers.transition, makeEvent("POST", `/api/v1/sessions/${session.sessionId}/phase`, {
      body: { action: "advance", seed: "" },
      pathParameters: { sessionId: session.sessionId },
      token: session.instructorToken,
    }));
    expect(transitioned.statusCode).toBe(400);
    expect(transitioned.body.code).toBe("INVALID_REQUEST_BODY");
  });
});

describe("concept Chains checked against the round's board", () => {
  const ON_BOARD_PATH = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ];

  /** A session in round 1's chain-mapping with one joined participant. */
  async function roundOneWithParticipant() {
    const sessionRepo = new InMemoryGameSessionRepository();
    const handlers = makeHandlers({ sessionRepo });
    const session = await createSession(handlers, "chain-check");
    const round1 = await session.advanceTo("round-1:chain-mapping");
    const joined = await invoke(handlers.join, makeEvent("POST", "/api/v1/sessions/join", {
      body: { roomCode: session.roomCode, displayName: "Alice" },
    }));
    expect(joined.statusCode).toBe(200);
    const participantToken = joined.body.participantToken as string;

    const submit = (body: object) => invoke(handlers.submit, makeEvent("POST", `/api/v1/sessions/${session.sessionId}/rounds/1/chains`, {
      body,
      pathParameters: { sessionId: session.sessionId, roundNumber: "1" },
      token: participantToken,
    }));
    const storedChains = async () =>
      (await sessionRepo.findById(SessionIdValue.from(session.sessionId)))!.chains;

    return { board: round1.activeBoard!, submit, storedChains };
  }

  const cardsAt = (board: BoardGridView, path: readonly { row: number; col: number }[]) =>
    path.map(cell => board.cells[cell.row]![cell.col]!.card.id);

  it("rejects a path with a cell outside the board with 422 CHAIN_TOPOLOGY_INVALID and records nothing", async () => {
    const { board, submit, storedChains } = await roundOneWithParticipant();
    const lastRow = board.rows - 1;
    const offBoard = [
      { row: lastRow - 2, col: 0 },
      { row: lastRow - 1, col: 0 },
      { row: lastRow, col: 0 },
      { row: lastRow + 1, col: 0 },
    ];

    const rejected = await submit({ path: offBoard, narrativeExplanation: "Off the edge" });

    expect(rejected.statusCode).toBe(422);
    expect(rejected.body.code).toBe("CHAIN_TOPOLOGY_INVALID");
    expect(await storedChains()).toHaveLength(0);
  });

  it("rejects a cell past the last column too", async () => {
    const { board, submit, storedChains } = await roundOneWithParticipant();
    const lastCol = board.cols - 1;
    const rejected = await submit({
      path: [
        { row: 0, col: lastCol - 2 },
        { row: 0, col: lastCol - 1 },
        { row: 0, col: lastCol },
        { row: 0, col: lastCol + 1 },
      ],
      narrativeExplanation: "Off the side",
    });

    expect(rejected.statusCode).toBe(422);
    expect(rejected.body.code).toBe("CHAIN_TOPOLOGY_INVALID");
    expect(await storedChains()).toHaveLength(0);
  });

  it("records and returns the board's cards when the client sends wrong keywordIds", async () => {
    const { board, submit } = await roundOneWithParticipant();

    const response = await submit({
      path: ON_BOARD_PATH,
      keywordIds: [
        "not-a-card",
        "also-wrong",
        "nope",
        "never",
      ],
      narrativeExplanation: "Wrong ids on purpose",
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.chain.keywordIds).toEqual(cardsAt(board, ON_BOARD_PATH));
  });

  it("accepts a path without keywordIds and derives them from the board", async () => {
    const { board, submit } = await roundOneWithParticipant();
    const path = [
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
    ];

    const response = await submit({ path, narrativeExplanation: "No ids sent" });

    expect(response.statusCode).toBe(201);
    expect(response.body.chain.keywordIds).toEqual(cardsAt(board, path));
  });

  it("stores the board-derived ids on the session", async () => {
    const { board, submit, storedChains } = await roundOneWithParticipant();

    const response = await submit({
      path: ON_BOARD_PATH,
      keywordIds: ["x", "y", "z", "w"],
      narrativeExplanation: "Stored",
    });

    expect(response.statusCode).toBe(201);
    expect((await storedChains()).map(chain => [...chain.keywordIds])).toEqual([
      cardsAt(board, ON_BOARD_PATH),
    ]);
  });

  it("keeps a legacy session's behaviour when its round has no board", async () => {
    const legacy = GameSessionAggregate.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    legacy.transitionTo("trial-orientation", new Date());
    legacy.transitionTo("round-1:chain-mapping", new Date());
    const participant = legacy.addParticipant("Legacy Lee");
    const sessionRepo = new InMemoryGameSessionRepository([legacy]);
    const tokenAdapter = new FakeCapabilityTokenAdapter();
    const token = await tokenAdapter.signToken({
      role: "participant",
      sessionId: legacy.sessionId.value,
      participantId: participant.participantId,
    });
    const submit = createSubmitChainHandler({ sessionRepo, tokenVerifier: tokenAdapter });
    const farAway = [
      { row: 50, col: 3 },
      { row: 51, col: 4 },
      { row: 52, col: 5 },
      { row: 53, col: 6 },
    ];

    const response = await invoke(submit, makeEvent("POST", `/api/v1/sessions/${legacy.sessionId.value}/rounds/1/chains`, {
      body: {
        path: farAway,
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "Legacy",
      },
      pathParameters: { sessionId: legacy.sessionId.value, roundNumber: "1" },
      token,
    }));

    expect(response.statusCode).toBe(201);
    expect(response.body.chain.keywordIds).toEqual(["kw-1", "kw-2", "kw-3", "kw-4"]);
    expect(response.body.chain.path).toEqual(farAway);
  });
});
