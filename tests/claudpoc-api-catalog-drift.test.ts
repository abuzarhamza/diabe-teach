import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

interface CatalogOperation {
  readonly method?: string;
  readonly path?: string;
  readonly status: "implemented" | "partial" | "specced-only" | "missing";
  readonly errors?: ReadonlyArray<{ readonly status: number; readonly code: string }>;
  readonly variants?: Record<string, { readonly errors?: ReadonlyArray<{ readonly status: number; readonly code: string }> }>;
}

interface CatalogTarget {
  readonly step?: string;
  readonly gap?: string;
  readonly ops?: readonly string[];
  readonly variant?: string;
}

interface ApiCatalog {
  readonly screens: ReadonlyArray<{ readonly id: string; readonly file: string }>;
  readonly nav?: Record<string, { readonly step?: string }>;
  readonly steps: Record<string, { readonly ops: readonly string[]; readonly screens: readonly string[]; readonly variant?: string }>;
  readonly operations: Record<string, CatalogOperation>;
  readonly gaps: Record<string, { readonly ops?: readonly string[] }>;
  readonly targets: Record<string, CatalogTarget>;
  readonly noScreen?: ReadonlyArray<{ readonly title: string; readonly actor: string; readonly ops: readonly string[] }>;
}

interface SpecOperation {
  readonly method: string;
  readonly path: string;
  readonly responseStatuses: readonly string[];
}

const root = resolve(import.meta.dirname, "..");

function loadCatalog(): ApiCatalog {
  // The catalog is a plain browser script that assigns a global; evaluate it without a DOM.
  const source = readFileSync(resolve(root, "claudPoc/concept-chain/api-catalog.js"), "utf8");
  const sandbox: { CC_API_CATALOG?: ApiCatalog } = {};
  runInNewContext(source, sandbox);
  if (!sandbox.CC_API_CATALOG) {
    throw new Error("api-catalog.js did not define CC_API_CATALOG");
  }
  return sandbox.CC_API_CATALOG;
}

function loadSpecOperations(): Map<string, SpecOperation> {
  const spec = parseYaml(readFileSync(resolve(root, "docs/api/openapi.yaml"), "utf8")) as {
    paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown> }>>;
  };
  const ops = new Map<string, SpecOperation>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (op?.operationId) {
        ops.set(op.operationId, {
          method: method.toUpperCase(),
          path,
          responseStatuses: Object.keys(op.responses ?? {}),
        });
      }
    }
  }
  return ops;
}

const catalog = loadCatalog();
const specOps = loadSpecOperations();
const specced = Object.entries(catalog.operations).filter(([, op]) => op.status !== "missing");

/** The step or gap, operations and variant a page's data-api key points at (mirrors api-overlay.js). */
function resolveKey(key: string): { readonly ops: readonly string[]; readonly variant?: string } | undefined {
  const target = catalog.targets[key] ?? {};
  if (key.startsWith("nav.")) {
    // Navigation only: no operations of its own; it must point at an existing step.
    const nav = catalog.nav?.[key.slice(4)];
    return nav && nav.step && catalog.steps[nav.step]
      ? { ops: [] }
      : undefined;
  }
  if (key.startsWith("gap.")) {
    const gap = catalog.gaps[target.gap ?? key.slice(4)];
    return gap
      ? { ops: target.ops ?? gap.ops ?? [], variant: target.variant }
      : undefined;
  }
  const step = catalog.steps[target.step ?? key.split(".")[0] ?? ""];
  return step
    ? { ops: target.ops ?? step.ops, variant: target.variant ?? step.variant }
    : undefined;
}

function screenApiKeys(file: string): string[] {
  const html = readFileSync(resolve(root, "claudPoc/concept-chain", file), "utf8");
  return [
    ...new Set([
      ...html.matchAll(/data-api="([^"]+)"/g),
    ].map(match => match[1] ?? "")),
  ];
}

describe("claudPoc Concept Chain API catalog matches docs/api/openapi.yaml", () => {
  it("declares at least one operation", () => {
    expect(specced.length).toBeGreaterThan(0);
  });

  it.each(specced)("%s exists in the spec with the same method and path", (opId, op) => {
    const spec = specOps.get(opId);
    expect(spec, `${opId} not found in openapi.yaml`).toBeDefined();
    expect(op.method).toBe(spec?.method);
    expect(op.path).toBe(spec?.path);
  });

  it.each(specced)("%s lists only error statuses the spec declares", (opId, op) => {
    const declared = specOps.get(opId)?.responseStatuses ?? [];
    const variantErrors = Object.values(op.variants ?? {}).flatMap(variant => variant.errors ?? []);
    for (const error of [
      ...(op.errors ?? []),
      ...variantErrors,
    ]) {
      expect(declared, `${opId} error ${error.status} ${error.code}`).toContain(String(error.status));
    }
  });

  it("every step references only operations in the catalog", () => {
    for (const [letter, step] of Object.entries(catalog.steps)) {
      for (const opId of step.ops) {
        expect(catalog.operations, `step ${letter} → ${opId}`).toHaveProperty([opId]);
      }
    }
  });

  it("every catalog operation is used by a step or listed as a gap", () => {
    const used = new Set([
      ...Object.values(catalog.steps).flatMap(step => step.ops),
      ...Object.values(catalog.gaps).flatMap(gap => gap.ops ?? []),
      ...Object.values(catalog.targets).flatMap(target => target.ops ?? []),
      ...(catalog.noScreen ?? []).flatMap(entry => entry.ops),
    ]);
    for (const opId of Object.keys(catalog.operations)) {
      expect(used.has(opId), `${opId} is not referenced`).toBe(true);
    }
  });

  it("every \"no screen yet\" legend entry references catalog operations that are in the spec", () => {
    for (const entry of catalog.noScreen ?? []) {
      expect(entry.ops.length, entry.title).toBeGreaterThan(0);
      for (const opId of entry.ops) {
        expect(catalog.operations, `noScreen ${entry.title} → ${opId}`).toHaveProperty([opId]);
        expect(specOps.has(opId), `noScreen ${entry.title} → ${opId} not in openapi.yaml`).toBe(true);
      }
    }
  });

  it("every step names the screens it happens on", () => {
    const screens = catalog.screens.map(screen => screen.id);
    for (const [letter, step] of Object.entries(catalog.steps)) {
      expect(step.screens.length, `step ${letter}`).toBeGreaterThan(0);
      for (const screen of step.screens) {
        expect(screens, `step ${letter} screen ${screen}`).toContain(screen);
      }
    }
  });

  it("lists every prototype page in the legend's screens, including Teacher login and Game setup", () => {
    expect(catalog.screens.map(screen => screen.file)).toEqual(
      expect.arrayContaining([
        "login.html",
        "setup.html",
        "teacher.html",
        "participant.html",
        "lobby.html",
      ]),
    );
    expect(catalog.steps.A?.screens).toContain("setup");
  });

  it.each([
    ["listCurriculumPacks", "GET", "/api/v1/packs"],
    ["getCurriculumPackById", "GET", "/api/v1/packs/{packId}"],
    ["validateCurriculumPack", "POST", "/api/v1/packs/validate"],
    ["registerCurriculumPack", "POST", "/api/v1/packs"],
  ])("pack operation %s is in the catalog and matches the spec (%s %s)", (opId, method, path) => {
    const op = catalog.operations[opId];
    expect(op, `${opId} missing from the catalog`).toBeDefined();
    expect(op?.method).toBe(method);
    expect(op?.path).toBe(path);
    expect(specOps.get(opId)?.method).toBe(method);
    expect(specOps.get(opId)?.path).toBe(path);
    const declared = specOps.get(opId)?.responseStatuses ?? [];
    for (const error of op?.errors ?? []) {
      expect(declared, `${opId} error ${error.status} ${error.code}`).toContain(String(error.status));
    }
  });

  it("every target references an existing step or gap, operation and variant", () => {
    for (const [key, target] of Object.entries(catalog.targets)) {
      const resolved = resolveKey(key);
      expect(resolved, `target ${key}`).toBeDefined();
      for (const opId of target.ops ?? []) {
        expect(catalog.operations, `target ${key} → ${opId}`).toHaveProperty([opId]);
      }
      if (resolved?.variant) {
        const hasVariant = resolved.ops.some(opId => catalog.operations[opId]?.variants?.[resolved.variant ?? ""]);
        expect(hasVariant, `target ${key} variant ${resolved.variant}`).toBe(true);
      }
    }
  });

  describe.each([
    "login.html",
    "setup.html",
    "teacher.html",
    "participant.html",
    "lobby.html",
  ])("%s", (file) => {
    const keys = screenApiKeys(file);

    it("marks at least one element", () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it.each(keys)("data-api=\"%s\" resolves to catalog operations that are in the spec unless missing", (key) => {
      const resolved = resolveKey(key);
      expect(resolved, `${file} data-api="${key}" has no catalog entry`).toBeDefined();
      for (const opId of resolved?.ops ?? []) {
        const op = catalog.operations[opId];
        expect(op, `${key} → ${opId}`).toBeDefined();
        if (op?.status !== "missing") {
          expect(specOps.has(opId), `${key} → ${opId} not in openapi.yaml`).toBe(true);
        }
      }
    });
  });
});
