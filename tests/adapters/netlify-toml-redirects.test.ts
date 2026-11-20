import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

// Every API function routes itself through its own `config.path` + `method`.
// A forced `netlify.toml` redirect matches every method and sends all of them
// to one function, which broke shared paths twice (api-completion ticket 10).
describe("netlify.toml has no /api/v1 redirects (api-completion 10)", () => {
  const repoRoot = join(import.meta.dirname, "../..");
  const toml = parse(readFileSync(join(repoRoot, "netlify.toml"), "utf8")) as {
    redirects?: Array<{ from?: string }>;
  };

  it("declares no redirect from an /api/v1 path", () => {
    const apiRedirects = (toml.redirects ?? [])
      .map(redirect => redirect.from ?? "")
      .filter(from => from === "/api/v1" || from.startsWith("/api/v1/"));
    expect(apiRedirects).toEqual([]);
  });

  it("each route file declares a unique path and method", () => {
    const functionsDir = join(repoRoot, "netlify/functions");
    const routes = readdirSync(functionsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => {
        const source = readFileSync(join(functionsDir, entry.name), "utf8");
        const path = /path:\s*"([^"]+)"/.exec(source)?.[1];
        const method = /method:\s*"([^"]+)"/.exec(source)?.[1];
        return { file: entry.name, route: `${method ?? "?"} ${path ?? "?"}` };
      });

    for (const { file, route } of routes) {
      expect(route, file).not.toContain("?");
    }
    const seen = routes.map(({ route }) => route);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
