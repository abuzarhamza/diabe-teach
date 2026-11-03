import { describe, expect, it } from "vitest";
import { InvalidPhaseTransitionError } from "../../src/domain/errors/domain-errors.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { RoomCode } from "../../src/domain/game-session/room-code.js";
import { SessionId } from "../../src/domain/game-session/session-id.js";

describe("sessionId value object", () => {
  it("creates a valid SessionId", () => {
    const sessionId = SessionId.generate();
    expect(sessionId.value).toMatch(/^[a-z0-9-]+$/);
    expect(sessionId.value.length).toBeGreaterThan(0);
  });

  it("creates SessionId from existing value", () => {
    const sessionId = SessionId.from("sess-123-abc");
    expect(sessionId.value).toBe("sess-123-abc");
  });

  it("two generated SessionIds are unique", () => {
    const id1 = SessionId.generate();
    const id2 = SessionId.generate();
    expect(id1.equals(id2)).toBe(false);
  });
});

describe("roomCode value object", () => {
  it("generates a 6-character alphanumeric room code", () => {
    const roomCode = RoomCode.generate();
    expect(roomCode.value).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("creates RoomCode from existing value", () => {
    const roomCode = RoomCode.from("ABC123");
    expect(roomCode.value).toBe("ABC123");
  });

  it("normalizes room code to uppercase", () => {
    const roomCode = RoomCode.from("abc123");
    expect(roomCode.value).toBe("ABC123");
  });
});

describe("gameSession aggregate", () => {
  const validProps = {
    packId: "diabe-teach",
    mode: "classroom" as const,
    adjudicationMode: "peer-instructor" as const,
  };

  it("creates a new game session with initial phase", () => {
    const session = GameSession.create(validProps);

    expect(session.sessionId).toBeDefined();
    expect(session.roomCode).toBeDefined();
    expect(session.packId).toBe("diabe-teach");
    expect(session.mode).toBe("classroom");
    expect(session.currentPhase).toBe("pretest");
    expect(session.participantCount).toBe(0);
  });

  it("allows valid phase transition from pretest to trial-orientation", () => {
    const session = GameSession.create(validProps);

    session.transitionTo("trial-orientation");

    expect(session.currentPhase).toBe("trial-orientation");
  });

  it("allows full phase progression through the FSM", () => {
    const session = GameSession.create(validProps);

    session.transitionTo("trial-orientation");
    session.transitionTo("round-1:chain-mapping");
    session.transitionTo("round-1:peer-adjudication");
    session.transitionTo("round-1:round-summary");
    session.transitionTo("round-2:chain-mapping");
    session.transitionTo("round-2:peer-adjudication");
    session.transitionTo("round-2:round-summary");
    session.transitionTo("posttest");
    session.transitionTo("feedback-survey");
    session.transitionTo("completed");

    expect(session.currentPhase).toBe("completed");
  });

  it("throws InvalidPhaseTransitionError for invalid transition", () => {
    const session = GameSession.create(validProps);

    expect(() => session.transitionTo("round-1:chain-mapping")).toThrow(
      InvalidPhaseTransitionError,
    );
  });

  it("adds participant to the session", () => {
    const session = GameSession.create(validProps);

    const participant = session.addParticipant("Alice");

    expect(participant.displayName).toBe("Alice");
    expect(participant.participantId).toBeDefined();
    expect(session.participantCount).toBe(1);
  });

  it("generates active board when entering round-1:chain-mapping", () => {
    const session = GameSession.create(validProps);
    session.transitionTo("trial-orientation");

    session.transitionTo("round-1:chain-mapping");

    expect(session.activeRoundNumber).toBe(1);
  });
});
