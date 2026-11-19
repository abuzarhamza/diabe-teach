import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createGetStandingsHandler } from "../../netlify/functions/sessions/get-standings.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";
import { createSignedInCreateSessionHandler, TEST_TEACHER } from "./support/signed-in-teacher.js";

/**
 * A copy of the built-in pack, stored under another id with only `cardCount`
 * of its Keyword Cards, as a pack saved before the capacity rule might be.
 */
function makeStoredPackWithCards(id: string, cardCount: number): CurriculumPack {
  return CurriculumPack.create({
    ...DIABE_TEACH_PACK,
    id,
    isSystemPack: false,
    cards: DIABE_TEACH_PACK.cards.slice(0, cardCount),
  });
}

function makeEvent(
  body: object,
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/api/v1/sessions",
    headers: { "content-type": "application/json" },
    queryStringParameters: null,
    pathParameters: null,
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    ...overrides,
  };
}

describe("post /api/v1/sessions", () => {
  const makeDeps = () => ({
    packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
    sessionRepo: new InMemoryGameSessionRepository(),
    tokenSigner: new FakeCapabilityTokenAdapter(),
    tokenVerifier: new FakeCapabilityTokenAdapter(),
    apiKey: undefined,
    requireApiKey: false,
  });

  it("creates a classroom session and returns sessionId, roomCode, instructorToken", async () => {
    const deps = makeDeps();
    const handler = createSignedInCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBeDefined();
    expect(body.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.instructorToken).toBeDefined();
    expect(body.state.currentPhase).toBe("pretest");
    expect(body.state.packId).toBe("diabe-teach");
    expect(body.participantId).toBeNull();
    expect(body.participantToken).toBeNull();
  });

  it("creates a solo session with auto-joined participant, with no Account Token and no owner", async () => {
    const deps = makeDeps();
    const handler = createCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "solo",
      adjudicationMode: "ai",
      creatorDisplayName: "Alice",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBeDefined();
    expect(body.instructorToken).toBeDefined();
    expect(body.participantId).toBeDefined();
    expect(body.participantToken).toBeDefined();
    expect(body.state.participantCount).toBe(1);
    const saved = await deps.sessionRepo.findById(SessionId.from(body.sessionId));
    expect(saved?.participants.map(p => p.displayName)).toEqual(["Alice"]);
    expect(saved?.ownerAccountId).toBeNull();
  });

  it("returns 404 when packId does not exist", async () => {
    const deps = makeDeps();
    const handler = createSignedInCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "unknown-pack",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("PACK_NOT_FOUND");
  });

  it("persists the session to the repository", async () => {
    const deps = makeDeps();
    const handler = createSignedInCreateSessionHandler(deps);

    const event = makeEvent({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    const response = await handler(event, {} as any);
    const body = JSON.parse(response.body);

    const saved = await deps.sessionRepo.findById(
      SessionId.from(body.sessionId),
    );
    expect(saved).not.toBeNull();
    expect(saved?.packId).toBe("diabe-teach");
  });

  describe("pack capacity: the pack must fill its board", () => {
    it("refuses a stored pack with fewer cards than rows × cols and stores no session", async () => {
      const deps = makeDeps();
      await deps.packRepo.create(makeStoredPackWithCards("short-pack", 48));
      const createSpy = vi.spyOn(deps.sessionRepo, "create");
      const handler = createSignedInCreateSessionHandler(deps);

      const response = await handler(
        makeEvent({
          packId: "short-pack",
          mode: "classroom",
          adjudicationMode: "peer-instructor",
        }),
        {} as any,
      );

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("PACK_VALIDATION_FAILED");
      expect(body.message).toContain("48");
      expect(body.message).toContain("7×7");
      expect(body.details).toEqual({
        packId: "short-pack",
        cardCount: 48,
        rows: 7,
        cols: 7,
        requiredCardCount: 49,
      });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("refuses a solo session too, before auto-joining anyone", async () => {
      const deps = makeDeps();
      await deps.packRepo.create(makeStoredPackWithCards("short-pack", 10));
      const createSpy = vi.spyOn(deps.sessionRepo, "create");
      const handler = createSignedInCreateSessionHandler(deps);

      const response = await handler(
        makeEvent({
          packId: "short-pack",
          mode: "solo",
          adjudicationMode: "ai",
          creatorDisplayName: "Alice",
        }),
        {} as any,
      );

      expect(response.statusCode).toBe(422);
      expect(JSON.parse(response.body).code).toBe("PACK_VALIDATION_FAILED");
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("creates a session with a pack that has more cards than rows × cols", async () => {
      const deps = makeDeps();
      await deps.packRepo.create(CurriculumPack.create({
        ...DIABE_TEACH_PACK,
        id: "roomy-pack",
        isSystemPack: false,
        boardConfig: { ...DIABE_TEACH_PACK.boardConfig, rows: 6, cols: 6 },
      }));
      const handler = createSignedInCreateSessionHandler(deps);

      const response = await handler(
        makeEvent({
          packId: "roomy-pack",
          mode: "classroom",
          adjudicationMode: "peer-instructor",
        }),
        {} as any,
      );

      expect(response.statusCode).toBe(201);
    });
  });
});

describe("post /api/v1/sessions: a classroom start needs a signed-in teacher", () => {
  const SECRET = "test-shared-token-secret";
  const CLASSROOM = { packId: "diabe-teach", mode: "classroom", adjudicationMode: "peer-instructor" };

  // Both token kinds share one secret on purpose: only the `kind` claim keeps
  // an instructor Capability Token from passing as an Account Token.
  function makeWorld() {
    const clock = new FakeClock(new Date("2026-11-19T08:00:00.000Z"));
    const accountTokens = new HmacAccountTokenAdapter(SECRET, clock);
    const capabilityTokens = new HmacCapabilityTokenAdapter(SECRET);
    const sessionRepo = new InMemoryGameSessionRepository();
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const deps = {
      packRepo,
      sessionRepo,
      tokenSigner: capabilityTokens,
      tokenVerifier: capabilityTokens,
      accountTokenVerifier: accountTokens,
      clock,
    };
    return {
      clock,
      accountTokens,
      capabilityTokens,
      sessionRepo,
      create: createCreateSessionHandler(deps),
      get: createGetSessionHandler(deps),
      transition: createTransitionPhaseHandler(deps),
      standings: createGetStandingsHandler(deps),
      adjudicate: createAdjudicateChainHandler(deps),
      signIn: async () => (await accountTokens.signAccountToken(TEST_TEACHER, clock.now())).token,
    };
  }

  function bearer(token: string) {
    return {
      headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
    };
  }

  async function call(
    handler: (event: APIGatewayProxyEvent, context: any) => Promise<any>,
    event: APIGatewayProxyEvent,
  ) {
    const response = await handler(event, {} as any);
    return {
      statusCode: response.statusCode as number,
      body: JSON.parse(response.body),
    };
  }

  it.each([
    [
      "no token",
      async () => ({}),
    ],
    [
      "an invalid token",
      async () => bearer("not-a-real-token"),
    ],
    [
      "an expired Account Token",
      async (world: ReturnType<typeof makeWorld>) => {
        const token = await world.signIn();
        world.clock.advanceSeconds(12 * 60 * 60 + 1);
        return bearer(token);
      },
    ],
    [
      "an instructor Capability Token instead of an Account Token",
      async (world: ReturnType<typeof makeWorld>) =>
        bearer(await world.capabilityTokens.signToken({ role: "instructor", sessionId: "some-session" })),
    ],
  ])("refuses a classroom start with %s with 401 and stores no session", async (_label, credentials) => {
    const world = makeWorld();
    const overrides = await credentials(world);
    const createSpy = vi.spyOn(world.sessionRepo, "create");

    const response = await call(world.create, makeEvent(CLASSROOM, overrides));

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED_TOKEN");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("starts a classroom session with a valid Account Token, answering as before and storing the account as owner", async () => {
    const world = makeWorld();

    const response = await call(world.create, makeEvent(CLASSROOM, bearer(await world.signIn())));

    expect(response.statusCode).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual(
      [
        "instructorToken",
        "participantId",
        "participantToken",
        "roomCode",
        "sessionId",
        "state",
      ],
    );
    expect(await world.capabilityTokens.verifyToken(response.body.instructorToken)).toMatchObject({
      role: "instructor",
      sessionId: response.body.sessionId,
    });
    const saved = await world.sessionRepo.findById(SessionId.from(response.body.sessionId));
    expect(saved?.ownerAccountId).toBe(TEST_TEACHER.accountId);
  });

  it("ignores an ownerAccountId sent in the request body", async () => {
    const world = makeWorld();

    const response = await call(world.create, makeEvent(
      { ...CLASSROOM, ownerAccountId: "someone-else" },
      bearer(await world.signIn()),
    ));

    const saved = await world.sessionRepo.findById(SessionId.from(response.body.sessionId));
    expect(saved?.ownerAccountId).toBe(TEST_TEACHER.accountId);
  });

  it("keeps accepting the session's instructor Capability Token on in-game routes after the Account Token expires", async () => {
    const world = makeWorld();
    const accountToken = await world.signIn();
    const created = await call(world.create, makeEvent(CLASSROOM, bearer(accountToken)));
    expect(created.statusCode).toBe(201);
    const { sessionId, instructorToken } = created.body as { sessionId: string; instructorToken: string };

    world.clock.advanceSeconds(13 * 60 * 60);
    expect(await world.accountTokens.verifyAccountToken(accountToken)).toBeNull();

    const sessionPath = `/api/v1/sessions/${sessionId}`;
    const inGame = (path: string, httpMethod: string, body: object | null, pathParameters: Record<string, string>) =>
      makeEvent(body ?? {}, {
        ...bearer(instructorToken),
        httpMethod,
        path,
        body: body
          ? JSON.stringify(body)
          : null,
        pathParameters,
      });

    const state = await call(world.get, inGame(sessionPath, "GET", null, { sessionId }));
    expect(state.statusCode).toBe(200);

    for (let step = 0; step < 2; step++) {
      const transitioned = await call(world.transition, inGame(`${sessionPath}/phase`, "POST", { action: "advance" }, { sessionId }));
      expect(transitioned.statusCode).toBe(200);
    }

    const standings = await call(world.standings, inGame(`${sessionPath}/rounds/1/standings`, "GET", null, { sessionId, roundNumber: "1" }));
    expect(standings.statusCode).toBe(200);

    // No chain exists, so the ruling is refused for that reason, not for the token.
    const ruling = await call(world.adjudicate, inGame(
      `${sessionPath}/rounds/1/chains/no-such-chain/adjudicate`,
      "POST",
      { action: "instructor-final", qualityScore: 3 },
      { sessionId, roundNumber: "1", chainId: "no-such-chain" },
    ));
    expect(ruling.statusCode).toBe(404);
    expect(ruling.body.code).toBe("CHAIN_NOT_FOUND");
  });
});
