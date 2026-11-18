import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";

// Loads claudPoc/concept-chain/shared.js (the in-browser demo mock of the Game Session API) without a DOM:
// only localStorage is needed for session creation, phases and chain submission.

interface GridCoord { readonly row: number; readonly col: number }
interface Board { readonly seed: string; readonly rows: number; readonly cols: number; readonly cells: readonly (readonly { readonly keywordId: string; readonly label: string }[])[] }
interface Pack { readonly packId: string; readonly name: string; readonly description: string; readonly keywords: readonly string[]; readonly boardSize: number }
interface Settings {
  readonly packId: string;
  readonly timerConfig: Record<string, number | null>;
  readonly seed: string | null;
  readonly creatorDisplayName: string | null;
  readonly boardSize: number;
  readonly minChainLength: number;
}
interface DemoState {
  readonly session: { readonly sessionId: string; readonly roomCode: string; readonly packId: string; readonly currentPhase: string; readonly phaseStartedAt: string; readonly phaseEndsAt: string | null; readonly activeBoard: Board | null };
  readonly participants: readonly { readonly participantId: string }[];
  readonly settings?: Settings;
}
interface DemoMock {
  readonly PHASES: readonly string[];
  readonly DEFAULT_PACK_ID: string;
  readonly TIMER_FIELDS: readonly string[];
  listPacks: () => Pack[];
  getPack: (id: string) => Pack | null;
  dealBoard: (args: { packId?: string; boardSize?: number; seed: string }) => Board;
  createSession: (settings?: Record<string, unknown>) => DemoState;
  reset: () => DemoState;
  get: () => DemoState;
  settingsOf: (s: DemoState) => Settings;
  advance: () => void;
  join: (roomCode: string, name: string) => { participantId: string };
  submitChain: (participantId: string, path: GridCoord[], story: string, rationales: unknown[]) => unknown;
  timerFromMinutes: (minutes: number | string, teacherPaced?: boolean) => number | null;
  timerLabel: (sec: number | null) => string;
  teacher: () => { name: string; email: string; signedInAt: string } | null;
  signIn: (name: string, email: string) => { name: string; email: string; signedInAt: string };
  signOut: () => void;
}

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "claudPoc/concept-chain/shared.js"), "utf8");

function loadMock(): DemoMock {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  // `const CC` is not a global property, so evaluate it as the script's last expression.
  return runInNewContext(`${source}\n;CC`, { localStorage }) as DemoMock;
}

function advanceTo(cc: DemoMock, phase: string): DemoState {
  while (cc.get().session.currentPhase !== phase) cc.advance();
  return cc.get();
}

function endsAfterStart(s: DemoState): number | null {
  return s.session.phaseEndsAt === null
    ? null
    : (Date.parse(s.session.phaseEndsAt) - Date.parse(s.session.phaseStartedAt)) / 1000;
}

const row = (n: number): GridCoord[] => Array.from({ length: n }, (_, col) => ({ row: 0, col }));

let cc: DemoMock;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T09:00:00Z"));
  cc = loadMock();
});
afterEach(() => vi.useRealTimers());

describe("shared demo mock: session settings", () => {
  it("uses the session's timerConfig for phaseEndsAt on chain mapping and peer review, null when teacher-paced", () => {
    cc.createSession({
      packId: "diabe-teach",
      timerConfig: { roundMappingSec: 600, roundAdjudicationSec: null },
    });
    expect(endsAfterStart(advanceTo(cc, "round-1:chain-mapping"))).toBe(600);
    expect(endsAfterStart(advanceTo(cc, "round-1:peer-adjudication"))).toBeNull();
    expect(endsAfterStart(advanceTo(cc, "round-2:chain-mapping"))).toBe(600);
    expect(endsAfterStart(advanceTo(cc, "round-2:peer-adjudication"))).toBeNull();
  });

  it("keeps today's 5/4-minute round timers and teacher-paced other phases with no settings", () => {
    cc.reset();
    expect(cc.get().session.packId).toBe("diabe-teach");
    expect(cc.get().session.phaseEndsAt).toBeNull();
    expect(endsAfterStart(advanceTo(cc, "trial-orientation"))).toBeNull();
    expect(endsAfterStart(advanceTo(cc, "round-1:chain-mapping"))).toBe(300);
    expect(endsAfterStart(advanceTo(cc, "round-1:peer-adjudication"))).toBe(240);
    expect(endsAfterStart(advanceTo(cc, "round-1:round-summary"))).toBeNull();
  });

  it("treats a session stored before settings existed as the default session", () => {
    const legacy: { -readonly [K in keyof DemoState]: DemoState[K] } = structuredClone(cc.reset());
    delete legacy.settings;
    expect(cc.settingsOf(legacy)).toMatchObject({
      packId: "diabe-teach",
      boardSize: 7,
      minChainLength: 2,
      seed: null,
    });
  });

  it.each([0, -5, 86401, 1.5, "300", Number.NaN])("rejects roundMappingSec %s with INVALID_REQUEST_BODY", (value) => {
    expect(() => cc.createSession({
      timerConfig: { roundMappingSec: value },
    })).toThrow(
      expect.objectContaining({
        code: "INVALID_REQUEST_BODY",
        message: expect.stringMatching(/roundMappingSec.*1 to 86400/),
      }),
    );
  });

  it("accepts the range edges and rejects an unknown timer field", () => {
    expect(() => cc.createSession({
      timerConfig: { roundMappingSec: 1, roundAdjudicationSec: 86400 },
    })).not.toThrow();
    expect(() => cc.createSession({
      timerConfig: { roundSec: 60 },
    })).toThrow(expect.objectContaining({ code: "INVALID_REQUEST_BODY" }));
  });

  it("knows exactly the SessionTimerConfig fields of the contract", () => {
    const spec = parseYaml(readFileSync(resolve(root, "docs/api/openapi.yaml"), "utf8")) as {
      components: { schemas: { SessionTimerConfig: { properties: Record<string, unknown> } } };
    };
    expect([...cc.TIMER_FIELDS].sort()).toEqual(Object.keys(spec.components.schemas.SessionTimerConfig.properties).sort());
  });

  it("rejects an unknown pack and a board too big for the pack", () => {
    expect(() => cc.createSession({ packId: "nope" })).toThrow(expect.objectContaining({ code: "PACK_NOT_FOUND" }));
    expect(() => cc.createSession({ packId: "thyroid", boardSize: 8 })).toThrow(expect.objectContaining({ code: "INVALID_REQUEST_BODY" }));
  });
});

describe("shared demo mock: boards and seeds", () => {
  it("deals the same board for the same seed, pack and size, and a different one for another seed", () => {
    const a = cc.dealBoard({ packId: "thyroid", boardSize: 5, seed: "abc" });
    expect(cc.dealBoard({ packId: "thyroid", boardSize: 5, seed: "abc" })).toEqual(a);
    expect(cc.dealBoard({ packId: "thyroid", boardSize: 5, seed: "abd" }).cells).not.toEqual(a.cells);
    expect(a.rows).toBe(5);
    expect(a.cells.flat()).toHaveLength(25);
    expect(new Set(a.cells.flat().map(c => c.label)).size).toBe(25);
    expect(a.cells.flat().every(c => cc.getPack("thyroid")?.keywords.includes(c.label))).toBe(true);
  });

  it("uses the creation seed for Round 1 and a fresh seed for Round 2", () => {
    cc.createSession({ packId: "anemia", boardSize: 6, seed: "preview-42" });
    const r1 = advanceTo(cc, "round-1:chain-mapping").session.activeBoard;
    expect(r1).toEqual(cc.dealBoard({ packId: "anemia", boardSize: 6, seed: "preview-42" }));
    const r2 = advanceTo(cc, "round-2:chain-mapping").session.activeBoard;
    expect(r2?.seed).not.toBe("preview-42");
    expect(r2?.rows).toBe(6);
    expect(r2?.cells).not.toEqual(r1?.cells);
  });
});

describe("shared demo mock: shortest chain", () => {
  it("rejects chains shorter than the session's shortest chain with CHAIN_TOPOLOGY_INVALID", () => {
    const { session } = cc.createSession({ minChainLength: 4 });
    const p = cc.join(cc.get().session.roomCode, "Ana");
    advanceTo(cc, "round-1:chain-mapping");
    expect(session.packId).toBe("diabe-teach");
    expect(() => cc.submitChain(p.participantId, row(3), "story", [])).toThrow(
      expect.objectContaining({ code: "CHAIN_TOPOLOGY_INVALID", message: "A chain needs at least 4 keywords." }),
    );
    expect(() => cc.submitChain(p.participantId, row(4), "story", [])).not.toThrow();
  });

  it("still accepts two-keyword chains in the default session", () => {
    cc.reset();
    const p = cc.join(cc.get().session.roomCode, "Ana");
    advanceTo(cc, "round-1:chain-mapping");
    expect(() => cc.submitChain(p.participantId, row(1), "story", [])).toThrow(expect.objectContaining({ message: "A chain needs at least two keywords." }));
    expect(() => cc.submitChain(p.participantId, row(2), "story", [])).not.toThrow();
  });
});

describe("shared demo mock: pack catalog", () => {
  it("offers the earlier prototype's built-in packs with Diabetes mellitus as the default", () => {
    const packs = cc.listPacks();
    expect(packs).toHaveLength(15);
    expect(cc.getPack(cc.DEFAULT_PACK_ID)?.name).toBe("Diabetes mellitus");
    for (const p of packs) {
      expect(p).toMatchObject({
        packId: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        boardSize: 7,
      });
      expect(new Set(p.keywords).size).toBe(p.keywords.length);
    }
  });
});

describe("shared demo mock: Game setup times", () => {
  it("converts whole minutes to seconds and teacher-paced to null", () => {
    expect(cc.timerFromMinutes(2)).toBe(120);
    expect(cc.timerFromMinutes("1440")).toBe(86400);
    expect(cc.timerFromMinutes("", true)).toBeNull();
    expect(cc.timerLabel(120)).toBe("2 min");
    expect(cc.timerLabel(null)).toBe("Teacher-paced");
  });

  it.each([0, 1441, 1.5, "", "abc", -1])("rejects %s minutes with a readable message", (value) => {
    expect(() => cc.timerFromMinutes(value)).toThrow(/whole minutes from 1 to 1440/);
  });

  it("a session started from Game setup times gets those deadlines", () => {
    cc.createSession({
      timerConfig: {
        roundMappingSec: cc.timerFromMinutes(2),
        roundAdjudicationSec: cc.timerFromMinutes("", true),
      },
    });
    expect(endsAfterStart(advanceTo(cc, "round-1:chain-mapping"))).toBe(120);
    expect(endsAfterStart(advanceTo(cc, "round-1:peer-adjudication"))).toBeNull();
  });
});

describe("shared demo mock: demo teacher sign-in", () => {
  it("remembers the teacher until sign-out", () => {
    expect(cc.teacher()).toBeNull();
    const t = cc.signIn("  Ms Rahman ", "rahman@school.org");
    expect(t).toMatchObject({
      name: "Ms Rahman",
      email: "rahman@school.org",
      signedInAt: expect.any(String),
    });
    expect(cc.teacher()).toEqual(t);
    cc.signOut();
    expect(cc.teacher()).toBeNull();
  });

  it("rejects a missing name or a malformed email", () => {
    expect(() => cc.signIn(" ", "a@b.org")).toThrow("Enter your name.");
    expect(() => cc.signIn("Ms Rahman", "rahman@school")).toThrow(/valid email/);
    expect(cc.teacher()).toBeNull();
  });
});
