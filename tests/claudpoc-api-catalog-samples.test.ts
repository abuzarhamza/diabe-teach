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
        stepRationales: ["Lower glucose over months."],
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
      stepRationales: ["Insulin moves glucose", "Glucose raises HbA1c"],
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

  it("lists the round's chains with display names, own chains only for a learner during chain-mapping", () => {
    const voted = demoState();
    voted.chains[0]!.peerVotes = [
      {
        voterParticipantId: "par_amira",
        decision: "approve",
        comment: null,
        votedAt: "2026-11-17T10:01:00.000Z",
      },
    ] as never;
    const teacher = sampleOf("listRoundChains")(voted);
    expect(teacher.path).toBe("/api/v1/sessions/ses_live1/rounds/2/chains");
    const chains = teacher.response?.body.chains as Array<Record<string, unknown>>;
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      chainId: "chn_ben1",
      participantDisplayName: "Ben",
      peerVotes: [
        { voterParticipantId: "par_amira", voterDisplayName: "Amira" },
      ],
    });
    expect(chains[0]).not.toHaveProperty("labels");
    const reviewing = sampleOf("listRoundChains")(voted, { participantId: "par_amira" });
    expect(reviewing.response?.body.chains).toHaveLength(1);
    const mapping = sampleOf("listRoundChains")(demoState("round-2:chain-mapping"), { participantId: "par_amira" });
    expect(mapping.response?.body.chains).toEqual([]);
    const own = sampleOf("listRoundChains")(demoState("round-2:chain-mapping"), { participantId: "par_ben" });
    expect(own.response?.body.chains).toHaveLength(1);
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
    const shownBoard = sampleOf("getGameSessionState")(state).response?.body.state as { activeBoard: { rows: number; cells: { row: number; col: number; card: { id: string; displayLabel: string } }[][] } };
    expect(shownBoard.activeBoard.rows).toBe(board.rows);
    expect(shownBoard.activeBoard.cells[1]?.[1]).toMatchObject({
      row: 1,
      col: 1,
      card: { id: "hba1c", displayLabel: "HbA1c" },
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

  /** Game setup's form as the page hands it to the overlay (CCOverlay.setContext). */
  const setupForm = {
    packId: "thyroid",
    creatorDisplayName: "Ms Rahman",
    mappingMinutes: "7",
    mappingPaced: false,
    adjudicationMinutes: "4",
    adjudicationPaced: true,
    seed: "seed-k3v9",
    boardSize: 5,
    minChainLength: "3",
  };

  it("builds Game setup's Start game createGameSession request from the form", () => {
    // No stored session yet (first visit to Game setup): the request comes from the form alone.
    const out = sampleOf("createGameSession")(null, { setup: setupForm });
    expect(out.request).toEqual({
      packId: "thyroid",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      creatorDisplayName: "Ms Rahman",
      timerConfig: {
        pretestSec: null,
        trialOrientationSec: null,
        roundMappingSec: 420,
        roundAdjudicationSec: null,
        posttestSec: null,
        feedbackSurveySec: null,
      },
      seed: "seed-k3v9",
    });
    expect(out.response?.status).toBe(201);
    expect(out.response?.body.state).toMatchObject({
      packId: "thyroid",
      currentPhase: "pretest",
      phaseEndsAt: null,
      participantCount: 0,
    });
  });

  it("follows the form: both phases timed, and a time outside 1-1440 minutes left as a placeholder", () => {
    const timed = sampleOf("createGameSession")(demoState(), {
      setup: { ...setupForm, adjudicationPaced: false, adjudicationMinutes: "1440" },
    });
    expect(timed.request?.timerConfig).toMatchObject({ roundMappingSec: 420, roundAdjudicationSec: 86400 });
    const bad = sampleOf("createGameSession")(null, {
      setup: { ...setupForm, mappingMinutes: "0" },
    });
    expect((bad.request?.timerConfig as Record<string, unknown>).roundMappingSec).toMatch(/^</);
    const paced = sampleOf("createGameSession")(null, {
      setup: { ...setupForm, mappingPaced: true, mappingMinutes: "" },
    });
    expect(paced.request?.timerConfig).toMatchObject({ roundMappingSec: null, roundAdjudicationSec: null });
  });

  it("shows the request that created the session on the teacher screen, with its timerConfig and seed", () => {
    const state = {
      ...demoState("round-1:round-summary"),
      settings: {
        packId: "thyroid",
        mode: "classroom",
        adjudicationMode: "peer-instructor",
        creatorDisplayName: "Ms Rahman",
        timerConfig: {
          pretestSec: null,
          trialOrientationSec: null,
          roundMappingSec: 120,
          roundAdjudicationSec: null,
          posttestSec: null,
          feedbackSurveySec: null,
        },
        seed: "seed-k3v9",
        boardSize: 5,
        minChainLength: 3,
      },
    };
    expect(sampleOf("createGameSession")(state).request).toEqual({
      packId: "thyroid",
      mode: "classroom",
      adjudicationMode: "peer-instructor",
      creatorDisplayName: "Ms Rahman",
      timerConfig: state.settings.timerConfig,
      seed: "seed-k3v9",
    });
    // Next phase into Round 2 chain mapping uses the session's 120 s, and teacher-paced peer review has no deadline.
    expect(sampleOf("transitionSessionPhase")(state).response?.body.state).toMatchObject({ currentPhase: "round-2:chain-mapping", phaseEndsAt: "<phaseStartedAt + 120 s>" });
    const review = {
      ...state,
      session: { ...state.session, currentPhase: "round-2:chain-mapping" },
    };
    expect(sampleOf("transitionSessionPhase")(review).response?.body.state).toMatchObject({ currentPhase: "round-2:peer-adjudication", phaseEndsAt: null });
  });

  it("fills the pack operations from Game setup's packs and create-pack editor", () => {
    const pack = {
      packId: "thyroid",
      name: "Thyroid disorders",
      group: "Clinical medicine",
      description: "Clinical medicine · built-in pack",
      keywords: ["TSH", "Iodine", "Goitre", "TRH"],
      maxBoardSize: 7,
    };
    const list = sampleOf("listCurriculumPacks")(null, {
      packs: [
        { ...pack, keywordCount: 49 },
      ],
    });
    expect(list.response?.body.packs).toEqual([
      expect.objectContaining({ id: "thyroid", title: "Thyroid disorders", cardCount: 49 }),
    ]);
    const get = sampleOf("getCurriculumPackById")(null, { pack });
    expect(get.path).toBe("/api/v1/packs/thyroid");
    expect((get.response?.body.pack as { cards: Array<{ displayLabel: string }> }).cards.map(card => card.displayLabel)).toEqual(["TSH", "Iodine", "Goitre"]);
    const newPack = {
      name: "Endocrine review",
      level: "Year 2",
      objective: "Explain insulin resistance",
      keywords: [
        "Insulin",
        "Glucose",
        "HbA1c",
        "Metformin",
      ],
    };
    const validate = sampleOf("validateCurriculumPack")(null, { newPack, setup: setupForm });
    expect(validate.request).toMatchObject({
      id: "endocrine-review",
      title: "Endocrine review",
      description: "Year 2 · Explain insulin resistance",
      boardConfig: { rows: 5, cols: 5, minChainLength: 3 },
    });
    const register = sampleOf("registerCurriculumPack")(null, { newPack, setup: setupForm });
    expect(register.request).toEqual(validate.request);
    expect(register.response?.body.pack).toMatchObject({ id: "endocrine-review", cardCount: 4 });
    expect(sampleOf("registerCurriculumPack")(null, {}).request).toBeUndefined();
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
      setup: setupForm,
      newPack: {
        name: "Pack",
        level: "",
        objective: "",
        keywords: ["A", "B"],
      },
    };
    const first = JSON.stringify(op.sample?.(state, ctx));
    expect(JSON.stringify(op.sample?.(state, ctx))).toBe(first);
    expect(JSON.stringify(state)).toBe(before);
    expect(first).not.toContain("{sessionId}");
  });
});
