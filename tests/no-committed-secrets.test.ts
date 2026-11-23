import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

/**
 * Guard: tracked test configs must never hold a real credential. API keys,
 * secrets, tokens and passwords must be an environment variable reference
 * (`${VAR}`), a `<placeholder>`, or empty; MongoDB URIs must not embed literal
 * credentials. Failures name the file and key path only, never the value.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SENSITIVE_KEY = /api[_-]?key|secret|token|password|passwd|credential/i;
const ENV_REFERENCE = /^\$\{[A-Z_]\w*\}$/i;
const PLACEHOLDER = /^<[^<>]+>$/;
const MONGO_URI_WITH_USERINFO = /mongodb(?:\+srv)?:\/\/([^@/\s"']+)@/gi;

function trackedConfigFiles(): string[] {
  const output = execFileSync(
    "git",
    [
      "ls-files",
      "--",
      // Plain pathspecs: `*` also matches `/`, so these cover every subfolder.
      "tests/*.yaml",
      "tests/*.yml",
      "tests/*.json",
      ".env*.example",
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return output.split("\n").filter(Boolean);
}

/** Builds an env var reference like the one in test-config.yaml. */
function envRef(name: string): string {
  return ["$", "{", name, "}"].join("");
}

function isSafeValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || ENV_REFERENCE.test(trimmed) || PLACEHOLDER.test(trimmed);
}

function isSafeMongoUserinfo(userinfo: string): boolean {
  const parts = userinfo.split(":");
  return parts.every(part => isSafeValue(part));
}

function parseConfig(file: string, content: string): unknown {
  if (file.endsWith(".json")) {
    return JSON.parse(content) as unknown;
  }
  return parseYaml(content) as unknown;
}

function findViolations(node: unknown, path: string, out: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => findViolations(item, `${path}[${index}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      const childPath = path
        ? `${path}.${key}`
        : key;
      if (SENSITIVE_KEY.test(key) && typeof value === "string" && !isSafeValue(value)) {
        out.push(`${childPath}: literal value (use an env var reference or <placeholder>)`);
      }
      findViolations(value, childPath, out);
    }
    return;
  }
  if (typeof node === "string") {
    for (const match of node.matchAll(MONGO_URI_WITH_USERINFO)) {
      if (!isSafeMongoUserinfo(match[1] ?? "")) {
        out.push(`${path}: MongoDB URI with literal credentials`);
      }
    }
  }
}

function scanConfigContent(file: string, content: string): string[] {
  const violations: string[] = [];
  findViolations(parseConfig(file, content), "", violations);
  return violations;
}

describe("no committed secrets in tracked test configs", () => {
  it("finds the tracked test config files", () => {
    expect(trackedConfigFiles()).toContain("tests/integration/test-config.yaml");
  });

  it("every tracked YAML/JSON test config uses env references or placeholders for credentials", () => {
    const report = trackedConfigFiles().flatMap(file =>
      scanConfigContent(file, readFileSync(join(REPO_ROOT, file), "utf8"))
        .map(violation => `${file} -> ${violation}`),
    );
    expect(report).toEqual([]);
  });

  it("flags literal keys and credentialed Mongo URIs, accepts references and placeholders", () => {
    const bad = [
      "env:",
      "  api_key: \"abc123realvalue\"",
      "  token_secret: s3cr3t",
      "  uri: \"mongodb+srv://alice:hunter2@cluster.example.net/db\"",
    ].join("\n");
    expect(scanConfigContent("x.yaml", bad)).toEqual([
      "env.api_key: literal value (use an env var reference or <placeholder>)",
      "env.token_secret: literal value (use an env var reference or <placeholder>)",
      "env.uri: MongoDB URI with literal credentials",
    ]);

    const good = JSON.stringify({
      api_key: envRef("API_KEY"),
      capability_token_secret: "<random-secret>",
      account_token_secret: "",
      uri: "mongodb+srv://<db_username>:<db_password>@<cluster-host>/",
      local_uri: "mongodb://localhost:27017/db",
    });
    expect(scanConfigContent("x.json", good)).toEqual([]);
  });
});
