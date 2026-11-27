// Game Session phases as the Session Shell shows them (react-web-ui spec, `session-phase.ts`).
// Pure rules: no React, no fetch, no storage. The server owns the phase; this only says, for the
// state's `currentPhase` and the seat's role, which view to render, its title and step, and which
// session controls the screen offers.

// docs/api/openapi.yaml `PhaseIdentifier`, in the order a Game Session moves through them.
export const PHASE_IDENTIFIERS = [
  "pretest",
  "trial-orientation",
  "round-1:chain-mapping",
  "round-1:peer-adjudication",
  "round-1:round-summary",
  "round-2:chain-mapping",
  "round-2:peer-adjudication",
  "round-2:round-summary",
  "posttest",
  "feedback-survey",
  "completed",
] as const;

export type PhaseIdentifier = typeof PHASE_IDENTIFIERS[number];

// The Capability Token seat's role: the teacher running the game, or a learner in it.
export type SessionRole = "instructor" | "participant";

// The phase views of features/game-session/views/. `pretest` shows the Lobby until the Assessment
// View exists (react-web-ui 06 decides how the Pre-test and the Lobby share that phase).
export type SessionView
  = | "lobby"
    | "assessment"
    | "orientation"
    | "chain-mapping"
    | "adjudication"
    | "round-summary"
    | "survey"
    | "results";

export interface PhaseScreen {
  title: string;
  // 1-based position of the phase in PHASE_IDENTIFIERS (of PHASE_STEP_COUNT).
  step: number;
  view: SessionView;
  // Instructor controls: Advance Phase, +1 Min Extend, End Session.
  canAdvance: boolean;
  canExtend: boolean;
  canEnd: boolean;
  // Learner control: Leave Session.
  canLeave: boolean;
}

export const PHASE_STEP_COUNT = PHASE_IDENTIFIERS.length;

interface PhaseFacts {
  title: string;
  view: SessionView;
  // The phase has a timer setting (SessionTimerConfig), so an instructor may extend it.
  // Round summaries and `completed` have none (their phaseEndsAt equals phaseStartedAt).
  timed: boolean;
}

const PHASE_FACTS: Readonly<Record<PhaseIdentifier, PhaseFacts>> = {
  "pretest": { title: "Pre-test", view: "lobby", timed: true },
  "trial-orientation": { title: "Trial round", view: "orientation", timed: true },
  "round-1:chain-mapping": { title: "Round 1: build chains", view: "chain-mapping", timed: true },
  "round-1:peer-adjudication": { title: "Round 1: peer review", view: "adjudication", timed: true },
  "round-1:round-summary": { title: "Round 1: results", view: "round-summary", timed: false },
  "round-2:chain-mapping": { title: "Round 2: build chains", view: "chain-mapping", timed: true },
  "round-2:peer-adjudication": { title: "Round 2: peer review", view: "adjudication", timed: true },
  "round-2:round-summary": { title: "Round 2: results", view: "round-summary", timed: false },
  "posttest": { title: "Post-test", view: "assessment", timed: true },
  "feedback-survey": { title: "Feedback survey", view: "survey", timed: true },
  "completed": { title: "Results", view: "results", timed: false },
};

export function isPhaseIdentifier(value: unknown): value is PhaseIdentifier {
  return typeof value === "string" && (PHASE_IDENTIFIERS as readonly string[]).includes(value);
}

// What the Session Shell shows in `phase` to someone holding a `role` seat. Whether a timed phase
// actually has a deadline (`phaseEndsAt` is null when instructor-driven) is phase-timer.ts's question.
export function phaseScreen(phase: PhaseIdentifier, role: SessionRole): PhaseScreen {
  const facts = PHASE_FACTS[phase];
  const open = phase !== "completed";
  const instructor = role === "instructor";
  return {
    title: facts.title,
    step: PHASE_IDENTIFIERS.indexOf(phase) + 1,
    view: facts.view,
    canAdvance: instructor && open,
    canExtend: instructor && facts.timed,
    canEnd: instructor && open,
    canLeave: !instructor && open,
  };
}

// The React key for a phase view: a new phase or a new round mounts the view afresh (no useEffect resets).
export function roundViewKey(phase: PhaseIdentifier, activeRoundNumber: number | null): string {
  return `${phase}:${activeRoundNumber ?? "-"}`;
}
