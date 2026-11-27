import type { PhaseIdentifier, PhaseScreen, SessionRole } from "../../src/domain/session-phase.ts";
import { describe, expect, it } from "vitest";
import { isPhaseIdentifier, PHASE_IDENTIFIERS, phaseScreen, roundViewKey } from "../../src/domain/session-phase.ts";

type Row = [PhaseIdentifier, string, PhaseScreen["view"]];

// Every PhaseIdentifier in docs/api/openapi.yaml, in the order a Game Session moves through them.
const PHASES: Row[] = [
  ["pretest", "Pre-test", "lobby"],
  ["trial-orientation", "Trial round", "orientation"],
  ["round-1:chain-mapping", "Round 1: build chains", "chain-mapping"],
  ["round-1:peer-adjudication", "Round 1: peer review", "adjudication"],
  ["round-1:round-summary", "Round 1: results", "round-summary"],
  ["round-2:chain-mapping", "Round 2: build chains", "chain-mapping"],
  ["round-2:peer-adjudication", "Round 2: peer review", "adjudication"],
  ["round-2:round-summary", "Round 2: results", "round-summary"],
  ["posttest", "Post-test", "assessment"],
  ["feedback-survey", "Feedback survey", "survey"],
  ["completed", "Results", "results"],
];

// Phases that have a timer setting (SessionTimerConfig): the only ones an instructor can extend.
const TIMED: PhaseIdentifier[] = [
  "pretest",
  "trial-orientation",
  "round-1:chain-mapping",
  "round-1:peer-adjudication",
  "round-2:chain-mapping",
  "round-2:peer-adjudication",
  "posttest",
  "feedback-survey",
];

describe("session-phase: currentPhase to screen and controls", () => {
  it("lists all 11 PhaseIdentifier values in session order", () => {
    expect(PHASE_IDENTIFIERS).toEqual(PHASES.map(([phase]) => phase));
  });

  describe.each(PHASES.map((row, index) => [...row, index + 1] as const))("%s", (phase, title, view, step) => {
    it.each<SessionRole>(["instructor", "participant"])("gives the %s the same title, step and view", (role) => {
      expect(phaseScreen(phase, role)).toMatchObject({ title, step, view });
    });

    it("gives the instructor Advance and End until completed, and Extend only on a timed phase, never Leave", () => {
      expect(phaseScreen(phase, "instructor")).toMatchObject({
        canAdvance: phase !== "completed",
        canExtend: TIMED.includes(phase),
        canEnd: phase !== "completed",
        canLeave: false,
      });
    });

    it("gives the participant only Leave, until completed", () => {
      expect(phaseScreen(phase, "participant")).toMatchObject({
        canAdvance: false,
        canExtend: false,
        canEnd: false,
        canLeave: phase !== "completed",
      });
    });
  });

  it("recognises a PhaseIdentifier and refuses anything else", () => {
    expect(isPhaseIdentifier("round-2:round-summary")).toBe(true);
    expect(isPhaseIdentifier("lobby")).toBe(false);
    expect(isPhaseIdentifier(undefined)).toBe(false);
  });

  it("keys a view by phase and round, so a view spanning rounds starts fresh each round", () => {
    expect(roundViewKey("round-1:chain-mapping", 1)).toBe("round-1:chain-mapping:1");
    expect(roundViewKey("pretest", null)).toBe("pretest:-");
  });
});
