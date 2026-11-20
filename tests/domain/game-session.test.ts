import type { PhaseIdentifier } from "../../src/domain/game-session/game-session.types.js";
import { describe, expect, it } from "vitest";
import { InvalidPhaseTransitionError } from "../../src/domain/errors/domain-errors.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";
import { PHASE_ORDER } from "../../src/domain/game-session/game-session.types.js";
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

    session.transitionTo("trial-orientation", new Date());

    expect(session.currentPhase).toBe("trial-orientation");
  });

  it("allows full phase progression through the FSM", () => {
    const session = GameSession.create(validProps);

    session.transitionTo("trial-orientation", new Date());
    session.transitionTo("round-1:chain-mapping", new Date());
    session.transitionTo("round-1:peer-adjudication", new Date());
    session.transitionTo("round-1:round-summary", new Date());
    session.transitionTo("round-2:chain-mapping", new Date());
    session.transitionTo("round-2:peer-adjudication", new Date());
    session.transitionTo("round-2:round-summary", new Date());
    session.transitionTo("posttest", new Date());
    session.transitionTo("feedback-survey", new Date());
    session.transitionTo("completed", new Date());

    expect(session.currentPhase).toBe("completed");
  });

  it("throws InvalidPhaseTransitionError for invalid transition", () => {
    const session = GameSession.create(validProps);

    expect(() => session.transitionTo("round-1:chain-mapping", new Date())).toThrow(
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
    session.transitionTo("trial-orientation", new Date());

    session.transitionTo("round-1:chain-mapping", new Date());

    expect(session.activeRoundNumber).toBe(1);
  });
});

describe("who may see a Gameplay Round's Concept Chains", () => {
  const validProps = {
    packId: "diabe-teach",
    mode: "classroom" as const,
    adjudicationMode: "peer-instructor" as const,
  };

  /** A session moved forward phase by phase until it reaches `phase`. */
  function sessionIn(phase: PhaseIdentifier): GameSession {
    const session = GameSession.create(validProps);
    for (const next of PHASE_ORDER.slice(1, PHASE_ORDER.indexOf(phase) + 1)) {
      session.transitionTo(next, new Date());
    }
    return session;
  }

  // [phase, may see classmates' Round 1 chains, may see classmates' Round 2 chains]
  const cases: Array<[PhaseIdentifier, boolean, boolean]> = [
    ["pretest", false, false],
    ["trial-orientation", false, false],
    ["round-1:chain-mapping", false, false],
    ["round-1:peer-adjudication", true, false],
    ["round-1:round-summary", true, false],
    ["round-2:chain-mapping", true, false],
    ["round-2:peer-adjudication", true, true],
    ["round-2:round-summary", true, true],
    ["posttest", true, true],
    ["feedback-survey", true, true],
    ["completed", true, true],
  ];

  it("covers every phase", () => {
    expect(cases.map(([phase]) => phase)).toEqual([...PHASE_ORDER]);
  });

  it.each(cases)("in %s a participant may see classmates' chains: Round 1 %s, Round 2 %s", (phase, round1, round2) => {
    const session = sessionIn(phase);

    expect(session.currentPhase).toBe(phase);
    expect(session.mayParticipantSeeClassmatesChains(1)).toBe(round1);
    expect(session.mayParticipantSeeClassmatesChains(2)).toBe(round2);
  });

  function chainBy(participantId: string, roundNumber: 1 | 2, minute: number): ConceptChain {
    return ConceptChain.create({
      participantId,
      roundNumber,
      path: Array.from({ length: 4 }, (_, col) => ({ row: minute, col })),
      keywordIds: [],
      narrativeExplanation: `${participantId} round ${roundNumber}`,
      submittedAt: new Date(`2026-11-19T10:0${minute}:00.000Z`),
    });
  }

  it("shows a participant only their own chains during chain-mapping, and every chain from peer-adjudication on", () => {
    const session = sessionIn("round-1:chain-mapping");
    const alice = session.addParticipant("Alice");
    const bob = session.addParticipant("Bob");
    const aliceChain = chainBy(alice.participantId, 1, 1);
    const bobChain = chainBy(bob.participantId, 1, 2);
    session.addChain(aliceChain, new Date());
    session.addChain(bobChain, new Date());
    const asBob = { role: "participant" as const, participantId: bob.participantId };
    const ids = (chains: readonly ConceptChain[]) => chains.map(c => c.chainId);

    expect(ids(session.getChainsForRoundVisibleTo(1, asBob))).toEqual([bobChain.chainId]);
    expect(ids(session.getChainsForRoundVisibleTo(1, { role: "instructor" })))
      .toEqual([aliceChain.chainId, bobChain.chainId]);

    session.transitionTo("round-1:peer-adjudication", new Date());

    expect(ids(session.getChainsForRoundVisibleTo(1, asBob)))
      .toEqual([aliceChain.chainId, bobChain.chainId]);
  });
});
