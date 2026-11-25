#!/usr/bin/env -S node --import tsx
/**
 * vapi: the verify-diabe-teach-api drive and evidence helper.
 *
 * A thin, curl-like wrapper over `fetch` for the local dev server. It exists
 * so the real API key never appears in a terminal transcript or an evidence
 * file: the key is loaded the same way `scripts/run-bruno-smoke.ts` loads it
 * (`AppRuntime.loadEnvConfig()`, i.e. `API_KEY` or `.env.dev.yaml`).
 *
 * Run every command from the repo root:
 *
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts init [run-id]
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts doctor
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts req <feature> <label> <METHOD> <path> [options]
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts bruno <feature> <bruno-folder>
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts set name=value
 *   node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts vars
 *
 * req options:
 *   --auth <var>          send `Authorization: Bearer <vars[var]>`
 *   --json '<json>'       request body (`{{var}}` placeholders are filled from vars)
 *   --bru-body <file.bru> use the `body:json` block of a Bruno request as the body
 *   --no-key              omit x-api-key (to prove the key check)
 *   --expect <status>     fail (exit 1) unless the HTTP status matches
 *   --expect-code <CODE>  fail unless the response body's `code` matches
 *   --expect-field dot.path=value
 *                         fail unless String(response field) equals value
 *                         (`{{var}}` allowed; repeatable)
 *   --save name=dot.path  store a response field in vars (repeatable)
 *
 * Evidence goes to `.verification/<run-id>/<feature>/NN-<label>.json`
 * (git-ignored, never deleted by cleanup). Token values and the API key are
 * redacted in evidence; the live values stay in `<run-dir>/vars.json`, which
 * cleanup deletes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { AppRuntime } from "../../../../src/app-runtime.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const BASE_URL = process.env.VERIFY_BASE_URL || "http://localhost:8888";
const VERIFY_ROOT = join(REPO_ROOT, ".verification");
const CURRENT_FILE = join(VERIFY_ROOT, "CURRENT");
const DEV_LOG = join(REPO_ROOT, ".netlify/dev-local.log");

process.chdir(REPO_ROOT);

type Vars = Record<string, string>;

function apiKey(): string {
  return AppRuntime.loadEnvConfig().apiKey || "dev-local-api-key";
}

function runDir(): string {
  if (!existsSync(CURRENT_FILE)) {
    throw new Error("No verification run. Run `vapi.ts init` (or launch.sh) first.");
  }
  return join(VERIFY_ROOT, readFileSync(CURRENT_FILE, "utf8").trim());
}

function varsFile(): string {
  return join(runDir(), "vars.json");
}

function loadVars(): Vars {
  const file = varsFile();
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as Vars : {};
}

function fill(text: string, vars: Vars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      throw new Error(`Unknown var {{${name}}}. Known: ${Object.keys(vars).join(", ") || "none"}`);
    }
    return value;
  });
}

function pick(value: unknown, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>(
    (current, key) => (current !== null && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined),
    value,
  );
}

/** Replaces every `*Token` string and the API key so evidence holds no secrets. */
function redact(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (/token$/i.test(key)) {
      return `<redacted ${key}: ${value.length} chars>`;
    }
    return value.split(apiKey()).join("<redacted api key>");
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

/** The JSON inside a Bruno request's `body:json { ... }` block. */
function bruBody(file: string): string {
  const lines = readFileSync(resolve(REPO_ROOT, file), "utf8").split("\n");
  const start = lines.findIndex(line => line.startsWith("body:json {"));
  const end = lines.findIndex((line, i) => i > start && line === "}");
  if (start < 0 || end < 0) {
    throw new Error(`${file} has no body:json block`);
  }
  return lines.slice(start + 1, end).join("\n");
}

function setVar(spec: string | undefined): void {
  const at = spec?.indexOf("=") ?? -1;
  if (!spec || at < 1) {
    throw new Error("usage: set name=value");
  }
  const vars = loadVars();
  vars[spec.slice(0, at)] = spec.slice(at + 1);
  writeFileSync(varsFile(), `${JSON.stringify(vars, null, 2)}\n`);
}

function nextEvidencePath(feature: string, label: string): string {
  const dir = join(runDir(), feature);
  mkdirSync(dir, { recursive: true });
  const index = String(readdirSync(dir).length + 1).padStart(2, "0");
  return join(dir, `${index}-${label}.json`);
}

function init(requested?: string): void {
  const id = requested || new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  mkdirSync(join(VERIFY_ROOT, id), { recursive: true });
  writeFileSync(CURRENT_FILE, `${id}\n`);
  console.log(join(VERIFY_ROOT, id));
}

async function probe(path: string, withKey: boolean): Promise<{ status: number | null; body: unknown }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: withKey ? { "x-api-key": apiKey() } : {},
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    }
    catch {}
    return { status: response.status, body };
  }
  catch {
    return { status: null, body: null };
  }
}

function sh(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  }
  catch {
    return "";
  }
}

async function doctor(): Promise<void> {
  const listeners = sh("lsof", ["-ti", "tcp:8888", "-sTCP:LISTEN"]).split(/\s+/).filter(Boolean);
  const log = existsSync(DEV_LOG) ? readFileSync(DEV_LOG, "utf8") : "";
  const health = await probe("/api/health", false);
  const packs = await probe("/api/v1/packs", true);
  const noKey = await probe("/api/v1/packs", false);
  const packIds = Array.isArray((packs.body as { packs?: unknown[] } | null)?.packs)
    ? ((packs.body as { packs: { id: string }[] }).packs).map(pack => pack.id)
    : [];
  const checks = {
    "port 8888 has a listener": listeners.length > 0,
    "dev-local.log says DEV READY (server started by dev:local)": log.includes("DEV READY"),
    "dev-local.log uses in-memory MongoDB": /MongoDB started at: mongodb:\/\/127\.0\.0\.1/.test(log),
    "GET /api/health -> 200": health.status === 200,
    "GET /api/v1/packs with key -> 200": packs.status === 200,
    "seeded System Pack diabe-teach is listed": packIds.includes("diabe-teach"),
    "GET /api/v1/packs without key -> 401 (key enforced)": noKey.status === 401,
  };
  const report = {
    at: new Date().toISOString(),
    baseUrl: BASE_URL,
    gitHead: sh("git", ["rev-parse", "--short", "HEAD"]),
    listenerPids: listeners,
    statuses: { health: health.status, packs: packs.status, packsWithoutKey: noKey.status },
    packIds,
    checks,
    healthy: Object.values(checks).every(Boolean),
  };
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`${ok ? "OK  " : "FAIL"} ${name}`);
  }
  console.log(`git HEAD ${report.gitHead}; listener pid(s) ${listeners.join(", ") || "none"}`);
  if (existsSync(CURRENT_FILE)) {
    const file = join(runDir(), "doctor.json");
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`evidence ${file}`);
  }
  console.log(report.healthy ? "DOCTOR HEALTHY" : "DOCTOR UNHEALTHY");
  process.exitCode = report.healthy ? 0 : 1;
}

function parseOptions(args: string[]): Map<string, string[]> {
  const options = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new Error(`Unexpected argument ${flag}`);
    }
    if (flag === "--no-key") {
      options.set(flag, ["true"]);
      continue;
    }
    const value = args[++i];
    if (value === undefined) {
      throw new Error(`${flag} needs a value`);
    }
    options.set(flag, [...(options.get(flag) ?? []), value]);
  }
  return options;
}

async function req(args: string[]): Promise<void> {
  const [feature, label, method, rawPath, ...rest] = args;
  if (!feature || !label || !method || !rawPath) {
    throw new Error("usage: req <feature> <label> <METHOD> <path> [options]");
  }
  const options = parseOptions(rest);
  const vars = loadVars();
  const path = fill(rawPath, vars);
  const headers: Record<string, string> = { Accept: "application/json" };
  const recordedHeaders: Record<string, string> = { ...headers };
  if (!options.has("--no-key")) {
    headers["x-api-key"] = apiKey();
    recordedHeaders["x-api-key"] = "<redacted api key>";
  }
  const authVar = options.get("--auth")?.[0];
  if (authVar) {
    const token = vars[authVar];
    if (!token) {
      throw new Error(`--auth ${authVar}: no such var. Known: ${Object.keys(vars).join(", ") || "none"}`);
    }
    headers.Authorization = `Bearer ${token}`;
    recordedHeaders.Authorization = `Bearer <${authVar}>`;
  }
  const bruFile = options.get("--bru-body")?.[0];
  const jsonBody = options.get("--json")?.[0] ?? (bruFile ? bruBody(bruFile) : undefined);
  let body: string | undefined;
  if (jsonBody !== undefined) {
    body = fill(jsonBody, vars);
    JSON.parse(body);
    headers["Content-Type"] = "application/json";
    recordedHeaders["Content-Type"] = "application/json";
  }

  const started = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body, signal: AbortSignal.timeout(60_000) });
  const text = await response.text();
  let responseBody: unknown = text;
  try {
    responseBody = JSON.parse(text);
  }
  catch {}

  const failures: string[] = [];
  const expectStatus = options.get("--expect")?.[0];
  if (expectStatus && Number(expectStatus) !== response.status) {
    failures.push(`expected status ${expectStatus}, got ${response.status}`);
  }
  const expectCode = options.get("--expect-code")?.[0];
  const code = pick(responseBody, "code");
  if (expectCode && code !== expectCode) {
    failures.push(`expected code ${expectCode}, got ${String(code)}`);
  }
  for (const spec of options.get("--expect-field") ?? []) {
    const at = spec.indexOf("=");
    const dotPath = spec.slice(0, at);
    const want = fill(spec.slice(at + 1), vars);
    const got = pick(responseBody, dotPath);
    if (at < 1 || String(got) !== want) {
      failures.push(`expected ${dotPath} = ${/token$/i.test(dotPath) ? "<token>" : want}, got ${/token$/i.test(dotPath) ? "<token>" : String(got)}`);
    }
  }
  for (const spec of options.get("--save") ?? []) {
    const [name, dotPath] = spec.split("=");
    const value = name && dotPath ? pick(responseBody, dotPath) : undefined;
    if (value === undefined || value === null) {
      failures.push(`--save ${spec}: response has no ${dotPath}`);
      continue;
    }
    vars[name!] = String(value);
  }
  writeFileSync(varsFile(), `${JSON.stringify(vars, null, 2)}\n`);

  const evidence = {
    feature,
    label,
    at: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    request: { method, url: `${BASE_URL}${path}`, headers: recordedHeaders, body: body === undefined ? null : redact(JSON.parse(body)) },
    response: { status: response.status, body: redact(responseBody) },
    expectations: { status: expectStatus ?? null, code: expectCode ?? null, fields: options.get("--expect-field") ?? [] },
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
  };
  const file = nextEvidencePath(feature, label);
  writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`${evidence.verdict} ${response.status} ${method} ${path} -> ${file.replace(`${REPO_ROOT}/`, "")}`);
  console.log(JSON.stringify(redact(responseBody)).slice(0, 600));
  for (const failure of failures) {
    console.log(`  ${failure}`);
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

function bruno(args: string[]): void {
  const [feature, folder] = args;
  if (!feature || !folder) {
    throw new Error("usage: bruno <feature> <folder under docs/api/bruno>");
  }
  const dir = join(runDir(), feature);
  mkdirSync(dir, { recursive: true });
  const report = join(dir, `bruno-${folder}.json`);
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [
      join(REPO_ROOT, "node_modules/@usebruno/cli/bin/bru.js"),
      "run",
      folder,
      "-r",
      "--env",
      "Local Dev",
      "--env-var",
      `baseUrl=${BASE_URL}`,
      "--env-var",
      `apiKey=${apiKey()}`,
      "--reporter-json",
      report,
      "--reporter-skip-headers",
      "x-api-key",
      "authorization",
    ], { cwd: join(REPO_ROOT, "docs/api/bruno"), stdio: "inherit" });
  }
  catch {
    exitCode = 1;
  }
  if (existsSync(report)) {
    writeFileSync(report, `${JSON.stringify(redact(JSON.parse(readFileSync(report, "utf8"))), null, 2)}\n`);
    console.log(`evidence ${report}`);
  }
  process.exitCode = exitCode;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "init":
      init(args[0]);
      break;
    case "doctor":
      await doctor();
      break;
    case "req":
      await req(args);
      break;
    case "bruno":
      bruno(args);
      break;
    case "set":
      setVar(args[0]);
      break;
    case "vars":
      console.log(Object.keys(loadVars()).join("\n"));
      break;
    default:
      console.error("usage: vapi.ts init [run-id] | doctor | req <feature> <label> <METHOD> <path> [options] | bruno <feature> <folder> | set name=value | vars");
      process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(`vapi: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
