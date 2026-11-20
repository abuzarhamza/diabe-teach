import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Loads claudPoc/concept-chain/account-api.js (the prototype's real API client) without a DOM:
// localStorage, sessionStorage, location, document and fetch are stubs.

interface Account { readonly accountId: string; readonly email: string; readonly accountToken: string; readonly expiresAt: string }
interface ApiError extends Error { readonly code: string; readonly status: number; readonly details: Record<string, unknown> | null }
interface PackInput {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly boardConfig: { readonly rows: number; readonly cols: number };
  readonly domains: ReadonlyArray<{ readonly id: string }>;
  readonly cards: ReadonlyArray<{ readonly id: string; readonly displayLabel: string; readonly domainId: string; readonly summary: string }>;
  readonly adjudicationRubric: { readonly chainContinuityCriteria: readonly string[] };
}
interface CCApi {
  readonly ACCOUNT_KEY: string;
  account: (now?: number) => Account | null;
  saveAccount: (body: Account) => Account;
  signOut: () => void;
  requireTeacher: () => Account | null;
  takeLoginMessage: () => string | null;
  signUp: (email: string, password: string) => Promise<Account>;
  signIn: (email: string, password: string) => Promise<Account>;
  listPacks: (opts?: { includeArchived?: boolean }) => Promise<unknown[]>;
  getPack: (id: string) => Promise<unknown>;
  archivePack: (id: string) => Promise<unknown>;
  registerPack: (input: unknown) => Promise<unknown>;
  loginErrorText: (e: unknown) => string;
  packErrorText: (e: unknown) => string;
  byline: (item: { authorHandle: string | null; version: string }) => string;
  toGamePack: (pack: unknown, item?: unknown) => { packId: string; name: string; version: string; keywords: string[] };
  nextVersion: (v: string) => string;
  packInput: (args: Record<string, unknown>) => PackInput;
}

const source = readFileSync(resolve(import.meta.dirname, "../claudPoc/concept-chain/account-api.js"), "utf8");

interface Harness {
  readonly api: CCApi;
  readonly store: Map<string, string>;
  readonly session: Map<string, string>;
  readonly location: { replace: ReturnType<typeof vi.fn> };
  readonly fetch: ReturnType<typeof vi.fn>;
}

function load(responses: Array<{ status: number; body?: unknown }> = []): Harness {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (m: Map<string, string>) => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  });
  const location = {
    replace: vi.fn(),
  };
  const queue = [...responses];
  const fetch = vi.fn(async () => {
    const next = queue.shift() ?? { status: 500 };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      text: async () => (next.body === undefined
        ? ""
        : JSON.stringify(next.body)),
    };
  });
  const api = runInNewContext(`${source}\n;CCApi`, {
    localStorage: storage(store),
    sessionStorage: storage(session),
    location,
    document: {
      documentElement: { style: {} },
    },
    fetch,
    Date,
    JSON,
  }) as CCApi;
  return { api, store, session, location, fetch };
}

const later = "2999-01-01T00:00:00.000Z";
const tokenBody = {
  accountId: "acc_1",
  email: "rahman.s@aku.edu",
  accountToken: "tok.en",
  expiresAt: later,
};

describe("claudPoc account-api.js: Account Token in browser storage", () => {
  it("signs up, keeps the token under its own key, and signs out", async () => {
    const h = load([
      { status: 201, body: tokenBody },
    ]);
    await h.api.signUp(" rahman.s@aku.edu ", "long-enough-pw");
    expect(h.fetch).toHaveBeenCalledWith("/api/v1/accounts/sign-up", expect.objectContaining({ method: "POST" }));
    const [, init] = h.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(JSON.parse(init.body)).toEqual({ email: "rahman.s@aku.edu", password: "long-enough-pw" });
    expect(init.headers).not.toHaveProperty("x-api-key");
    expect(JSON.parse(h.store.get(h.api.ACCOUNT_KEY) ?? "{}")).toMatchObject({ email: "rahman.s@aku.edu", accountToken: "tok.en" });
    expect(h.api.account()?.email).toBe("rahman.s@aku.edu");
    h.api.signOut();
    expect(h.api.account()).toBeNull();
    expect(h.store.has(h.api.ACCOUNT_KEY)).toBe(false);
  });

  it("refuses a short password before calling the API", async () => {
    const h = load();
    await expect(h.api.signUp("a@b.org", "short")).rejects.toMatchObject({
      code: "INVALID_REQUEST_BODY",
      details: { field: "password" },
    });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("treats an expired token as signed out and sends the teacher to Teacher login with a message", () => {
    const h = load();
    h.api.saveAccount({ ...tokenBody, expiresAt: "2000-01-01T00:00:00.000Z" });
    expect(h.api.account()).toBeNull();
    expect(h.api.requireTeacher()).toBeNull();
    expect(h.location.replace).toHaveBeenCalledWith("login.html");
    expect(h.api.takeLoginMessage()).toMatch(/expired/);
    expect(h.api.takeLoginMessage()).toBeNull();
  });

  it("sends a teacher with no token to Teacher login", () => {
    const h = load();
    expect(h.api.requireTeacher()).toBeNull();
    expect(h.api.takeLoginMessage()).toBe("Sign in to continue.");
  });

  it("sends the teacher to Teacher login when the server rejects the token (401)", async () => {
    const h = load([
      {
        status: 401,
        body: { code: "UNAUTHORIZED_TOKEN", message: "Malformed, invalid, or expired account token." },
      },
    ]);
    h.api.saveAccount(tokenBody);
    await expect(h.api.archivePack("p")).rejects.toMatchObject({ code: "UNAUTHORIZED_TOKEN", status: 401 });
    const [, init] = h.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.authorization).toBe("Bearer tok.en");
    expect(h.api.account()).toBeNull();
    expect(h.location.replace).toHaveBeenCalledWith("login.html");
  });

  it("does not redirect on a wrong password, and words each Teacher login error", async () => {
    const h = load([
      {
        status: 401,
        body: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
      },
    ]);
    const err = await h.api.signIn("a@b.org", "wrong-password").catch((e: ApiError) => e);
    expect(h.location.replace).not.toHaveBeenCalled();
    expect(h.api.loginErrorText(err)).toBe("Wrong email or password.");
    expect(h.api.loginErrorText({ code: "EMAIL_ALREADY_REGISTERED" })).toMatch(/already registered/);
    expect(h.api.loginErrorText({
      code: "INVALID_REQUEST_BODY",
      details: { field: "password" },
    })).toMatch(/Password too short/);
    expect(h.api.loginErrorText({
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      details: { lockedUntil: "2026-11-19T08:15:00.000Z" },
    })).toMatch(/temporarily locked until/);
  });
});

describe("claudPoc account-api.js: shared pack library", () => {
  it("lists archived packs only when asked, and reads the legacy { error: { code } } body", async () => {
    const h = load([
      {
        status: 200,
        body: {
          packs: [
            { id: "a" },
          ],
        },
      },
      {
        status: 409,
        body: {
          error: { code: "PACK_ALREADY_EXISTS", message: "exists" },
        },
      },
    ]);
    h.api.saveAccount(tokenBody);
    await h.api.listPacks({ includeArchived: true });
    expect(h.fetch.mock.calls[0]?.[0]).toBe("/api/v1/packs?includeArchived=true");
    const err = await h.api.registerPack({}).catch((e: ApiError) => e);
    expect(err).toMatchObject({ code: "PACK_ALREADY_EXISTS", status: 409 });
    expect(h.api.packErrorText(err)).toMatch(/already exists/);
  });

  it("fetches a pack without an Authorization header (that route reads bearer tokens as Capability Tokens)", async () => {
    const h = load([
      {
        status: 200,
        body: {
          pack: { id: "a" },
        },
      },
    ]);
    h.api.saveAccount(tokenBody);
    await h.api.getPack("a");
    const [, init] = h.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("shows the author handle and version, and bumps the minor version", () => {
    expect(load().api.byline({ authorHandle: "rahman.s", version: "1.1.0" })).toBe("by rahman.s · v1.1.0");
    expect(load().api.byline({ authorHandle: null, version: "1.0.0" })).toBe("by unknown · v1.0.0");
    expect(load().api.nextVersion("1.4.2")).toBe("1.5.0");
  });

  it("builds a valid new pack from a keyword list", () => {
    const keywords = Array.from({ length: 10 }, (_, i) => `Word ${i + 1}`);
    const input = load().api.packInput({
      name: " Endocrine  review ",
      level: "Year 2",
      objective: "",
      keywords,
      packId: "endocrine-review",
    });
    expect(input).toMatchObject({
      id: "endocrine-review",
      title: "Endocrine review",
      version: "1.0.0",
      description: "Year 2",
      boardConfig: { rows: 3, cols: 3 },
    });
    expect(input.cards.map(c => c.id)).toEqual(keywords.map((_, i) => `word-${i + 1}`));
    expect(input.cards.every(c => c.domainId === input.domains[0]?.id && c.summary)).toBe(true);
    expect(input.adjudicationRubric.chainContinuityCriteria.length).toBeGreaterThan(0);
  });

  it("releases a new version that keeps the pack's id, domains and the cards of keywords it still has", () => {
    const api = load().api;
    const base = {
      id: "probe",
      title: "Probe",
      version: "1.0.0",
      description: "d",
      boardConfig: {
        rows: 3,
        cols: 3,
        minChainLength: 2,
        adjacencyRule: "chebyshev-8",
      },
      domains: [
        { id: "dom", label: "Dom", description: "" },
      ],
      cards: [
        {
          id: "alpha-card",
          verbatimLabel: "Alpha",
          displayLabel: "Alpha",
          aliases: ["A"],
          domainId: "dom",
          summary: "First",
        },
      ],
      adjudicationRubric: {
        evaluatorPersona: "p",
        subjectDomain: "s",
        chainContinuityCriteria: ["c"],
        calibrationExamples: [],
      },
      assessmentInstrument: null,
      perceptionSurvey: null,
    };
    expect(api.toGamePack(base).keywords).toEqual(["Alpha"]);
    const keywords = [
      "Alpha",
      ...Array.from({ length: 9 }, (_, i) => `New ${i + 1}`),
    ];
    const input = api.packInput({ name: "Probe", keywords, base });
    expect(input).toMatchObject({ id: "probe", version: "1.1.0", description: "d" });
    expect(input.cards[0]).toEqual(base.cards[0]);
    expect(input.cards.slice(1).every(c => c.domainId === "dom")).toBe(true);
  });
});
