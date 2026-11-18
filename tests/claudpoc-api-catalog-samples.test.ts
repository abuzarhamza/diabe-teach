import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

interface GridCoord { readonly row: number; readonly col: number }

interface SampleResult {
  readonly path?: string;
  readonly request?: Record<string, unknown>;
  readonly response?: { readonly status: number; readonly body: Record<string, unknown> };
}

type SampleFn = (state: unknown, ctx?: Record<string, unknown>) => SampleResult;

interface ApiCatalog {
  readonly phases: readonly string[];
  readonly operations: Record<string, { readonly path?: string; readonly sample?: SampleFn }>;
}

const root = resolve(import.meta.dirname, "..");

function loadCatalog(): ApiCatalog {
  const source = readFileSync(resolve(root, "claudPoc/concept-chain/api-catalog.js"), "utf8");
  const sandbox: { CC_API_CATALOG?: ApiCatalog } = {};
  runInNewContext(source, sandbox);
  if (!sandbox.CC_API_CATALOG) {
    throw new Error("api-catalog.js did not define CC_API_CATALOG");
  }
  return sandbox.CC_API_CATALOG;
}

const catalog = loadCatalog();

function sampleOf(opId: string): SampleFn {
  const sample = catalog.operations[opId]?.sample;
  if (!sample) {
    throw new Error(`${opId} has no sample builder`);
  }
  return sample;
}

const board = {
  seed: "seed",
  rows: 2,
  cols: 2,
  cells: [
    [
      { keywordId: "insulin", label: "Insulin" },
      { keywordId: "glucose", label: "Glucose" },
    ],
    [
      { keywordId: "diet", label: "Diet" },
      { keywordId: "hba1c", label: "HbA1c" },
    ],
  ],
};

/** A demo session (CC.get() shape) in Round 2 peer review with two learners and one chain. */
function demoState(phase = "round-2:peer-adjudication") {
  return {
    session: {
      sessionId: "ses_live1",
      roomCode: "ROOM42",
      packId: "diabe-teach",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      currentPhase: phase,
      activeRoundNumber: 2,
      phaseStartedAt: "2026-11-17T10:00:00.000Z",
      phaseEndsAt: "2026-11-17T10:04:00.000Z",
      activeBoard: board,
      participantCount: 2,
    },
    participants: [
      { participantId: "par_amira", displayName: "Amira", joinedAt: "2026-11-17T09:00:00.000Z" },
      { participantId: "par_ben", displayName: "Ben", joinedAt: "2026-11-17T09:01:00.000Z" },
    ],
    chains: [
      {
        chainId: "chn_ben1",
        sessionId: "ses_live1",
        roundNumber: 2,
        participantId: "par_ben",
        path: [
          { row: 0, col: 0 },
          { row: 1, col: 1 },
        ],
        keywordIds: ["insulin", "hba1c"],
        labels: ["Insulin", "HbA1c"],
        narrativeExplanation: "Insulin lowers HbA1c.",
        stepRationales: [
          {
            fromCoord: { row: 0, col: 0 },
            toCoord: { row: 1, col: 1 },
            rationale: "Lower glucose over months.",
          },
        ],
        status: "approved",
        verdict: null,
        peerVotes: [],
        submittedAt: "2026-11-17T09:50:00.000Z",
      },
    ],
  };
}

describe("claudPoc Concept Chain live API samples", () => {
  it("knows the spec's phase order", () => {
    const spec = parseYaml(readFileSync(resolve(root, "docs/api/openapi.yaml"), "utf8")) as {
      components: { schemas: { PhaseIdentifier: { enum: string[] } } };
    };
    expect([...catalog.phases]).toEqual(spec.components.schemas.PhaseIdentifier.enum);
  });

  it("turns the learner's draft chain into a GridCoord path with stepRationales", () => {
    const path: GridCoord[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ];
    const out = sampleOf("submitConceptChain")(demoState("round-2:chain-mapping"), {
      participantId: "par_amira",
      draft: {
        path,
        links: [" Insulin moves glucose ", "Glucose raises HbA1c"],
        story: " The story ",
      },
    });
    expect(out.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains");
    expect(out.request).toEqual({
      path,
      narrativeExplanation: "The story",
      stepRationales: [
        { fromCoord: path[0], toCoord: path[1], rationale: "Insulin moves glucose" },
        { fromCoord: path[1], toCoord: path[2], rationale: "Glucose raises HbA1c" },
      ],
    });
    const chain = out.response?.body.chain as Record<string, unknown>;
    expect(out.response?.status).toBe(201);
    expect(chain.keywordIds).toEqual(["insulin", "glucose", "hba1c"]);
    expect(chain.participantId).toBe("par_amira");
    expect(chain.chainId).toBe("<chainId>");
  });

  it("falls back to the fixed submit example while nothing is built", () => {
    const out = sampleOf("submitConceptChain")(demoState("round-2:chain-mapping"), {
      draft: { path: [], links: [], story: "" },
    });
    expect(out.request).toBeUndefined();
    expect(out.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains");
  });

  it("uses the chain under the cursor for peer votes", () => {
    const out = sampleOf("adjudicateConceptChain")(demoState(), {
      variant: "peer-challenge",
      chainId: "chn_ben1",
      participantId: "par_amira",
      voteNotes: { chn_ben1: " Step 1 is weak " },
    });
    expect(out.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains/chn_ben1/adjudicate");
    expect(out.request).toEqual({ action: "peer-challenge", comment: "Step 1 is weak" });
    const chain = out.response?.body.chain as { chainId: string; peerVotes: unknown[] };
    expect(chain.chainId).toBe("chn_ben1");
    expect(chain.peerVotes).toEqual([
      {
        voterParticipantId: "par_amira",
        decision: "challenge",
        comment: "Step 1 is weak",
        votedAt: "<votedAt>",
      },
    ]);
  });

  it("uses the chain and the teacher's draft for an Instructor Final Ruling", () => {
    const out = sampleOf("adjudicateConceptChain")(demoState(), {
      variant: "instructor-reject",
      chainId: "chn_ben1",
      rulings: {
        chn_ben1: { feedback: "Name the mechanism.", score: "4" },
      },
    });
    expect(out.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains/chn_ben1/adjudicate");
    expect(out.request).toEqual({ action: "instructor-reject", feedback: "Name the mechanism.", qualityScore: 4 });
    const chain = out.response?.body.chain as { status: string; verdict: { isLocked: boolean } };
    expect(chain.status).toBe("rejected");
    expect(chain.verdict.isLocked).toBe(true);
  });

  it("leaves chainId as a template param when no chain is under the cursor", () => {
    const out = sampleOf("adjudicateConceptChain")(demoState(), { variant: "peer-approve", chainId: null });
    expect(out.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains/{chainId}/adjudicate");
    expect(out.request).toBeUndefined();
  });

  it("fills session reads, phase changes and standings from the live session", () => {
    const state = demoState();
    expect(sampleOf("getGameSessionState")(state).path).toBe("/api/v1/sessions/ses_live1");
    expect(sampleOf("getGameSessionState")(state).response?.body.state).toMatchObject({
      sessionId: "ses_live1",
      roomCode: "ROOM42",
      currentPhase: "round-2:peer-adjudication",
      phaseEndsAt: "2026-11-17T10:04:00.000Z",
      participantCount: 2,
    });
    expect(sampleOf("transitionSessionPhase")(state).response?.body.state).toMatchObject({ currentPhase: "round-2:round-summary", activeRoundNumber: 2, phaseEndsAt: null });
    const standings = sampleOf("getRoundStandings")(state);
    expect(standings.path).toBe("/api/v1/sessions/ses_live1/rounds/2/standings");
    expect(standings.response?.body.standings).toEqual([
      {
        rank: 1,
        participantId: "par_ben",
        displayName: "Ben",
        longestValidChainLength: 2,
        totalValidChainsCount: 1,
        cumulativeRationaleScore: 0,
        approvedChainIds: ["chn_ben1"],
      },
      {
        rank: 2,
        participantId: "par_amira",
        displayName: "Amira",
        longestValidChainLength: 0,
        totalValidChainsCount: 0,
        cumulativeRationaleScore: 0,
        approvedChainIds: [],
      },
    ]);
    expect(sampleOf("joinGameSession")(state, { participantId: "par_amira" }).request).toEqual({ roomCode: "ROOM42", displayName: "Amira" });
  });

  it.each(Object.entries(catalog.operations).filter(([, op]) => op.sample))("%s sample is deterministic and does not mutate the session", (_opId, op) => {
    const state = demoState("round-2:chain-mapping");
    const before = JSON.stringify(state);
    const ctx = {
      chainId: "chn_ben1",
      participantId: "par_amira",
      draft: {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        links: ["x"],
        story: "y",
      },
    };
    const first = JSON.stringify(op.sample?.(state, ctx));
    expect(JSON.stringify(op.sample?.(state, ctx))).toBe(first);
    expect(JSON.stringify(state)).toBe(before);
    expect(first).not.toContain("{sessionId}");
  });
});
