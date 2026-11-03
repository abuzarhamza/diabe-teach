import { describe, expect, it } from "vitest";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { RoomCode } from "../../src/domain/game-session/room-code.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";

describe("inMemoryGameSessionRepository", () => {
  it("creates and retrieves a session by id", async () => {
    const repo = new InMemoryGameSessionRepository();
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    await repo.create(session);
    const found = await repo.findById(session.sessionId);

    expect(found).toBe(session);
  });

  it("retrieves a session by room code", async () => {
    const repo = new InMemoryGameSessionRepository();
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });

    await repo.create(session);
    const found = await repo.findByRoomCode(session.roomCode);

    expect(found).toBe(session);
  });

  it("returns null for non-existent session id", async () => {
    const repo = new InMemoryGameSessionRepository();

    const found = await repo.findById(SessionId.from("non-existent"));

    expect(found).toBeNull();
  });

  it("returns null for non-existent room code", async () => {
    const repo = new InMemoryGameSessionRepository();

    const found = await repo.findByRoomCode(RoomCode.from("XXXXXX"));

    expect(found).toBeNull();
  });

  it("updates an existing session", async () => {
    const repo = new InMemoryGameSessionRepository();
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    await repo.create(session);

    session.transitionTo("trial-orientation");
    await repo.update(session);

    const found = await repo.findById(session.sessionId);
    expect(found?.currentPhase).toBe("trial-orientation");
  });

  it("initializes with pre-existing sessions", async () => {
    const session = GameSession.create({
      packId: "diabe-teach",
      mode: "solo",
      adjudicationMode: "ai",
    });
    const repo = new InMemoryGameSessionRepository([session]);

    const found = await repo.findById(session.sessionId);

    expect(found).toBe(session);
  });
});
