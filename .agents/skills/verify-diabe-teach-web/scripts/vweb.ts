#!/usr/bin/env -S node --import tsx
/**
 * vweb: the verify-diabe-teach-web doctor and evidence helper.
 *
 * Run every command from the repo root:
 *
 *   node --import tsx .agents/skills/verify-diabe-teach-web/scripts/vweb.ts doctor
 *   <json or text on stdin> | node --import tsx .agents/skills/verify-diabe-teach-web/scripts/vweb.ts record <feature> <label>
 *   node --import tsx .agents/skills/verify-diabe-teach-web/scripts/vweb.ts keep <feature> <label> <screenshot-file>
 *
 * `doctor` only reads. It checks that this run's Vite owns :5173, that the API behind
 * it is `dev:prototype` (key check off) with in-memory MongoDB, that the proxy works,
 * and that the served bundle carries no VITE_API_KEY. Writes <run-dir>/web-doctor.json.
 *
 * `record` saves what the browser showed (a read_page / get_page_text / javascript_tool
 * result) as <run-dir>/<feature>/NN-<label>.json (or .txt when stdin is not JSON),
 * with every `*Token` value and every JWT-shaped string redacted.
 *
 * `keep` copies a screenshot saved by the browser tool into <run-dir>/<feature>/NN-<label>.<ext>.
 * Look at the screenshot first: it must not show a token.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const WEB_URL = "http://localhost:5173";
const VERIFY_ROOT = join(REPO_ROOT, ".verification");
const CURRENT_FILE = join(VERIFY_ROOT, "CURRENT");
const DEV_LOG = join(REPO_ROOT, ".netlify/dev-local.log");
const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;

process.chdir(REPO_ROOT);

function runDir(): string {
  if (!existsSync(CURRENT_FILE))
    throw new Error("No verification run. Run launch.sh first.");
  return join(VERIFY_ROOT, readFileSync(CURRENT_FILE, "utf8").trim());
}

function sh(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  }
  catch {
    return "";
  }
}

function read(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function redact(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (/token$/i.test(key))
      return `<redacted ${key}: ${value.length} chars>`;
    return value.replace(JWT, "<redacted jwt>");
  }
  if (Array.isArray(value))
    return value.map(item => redact(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  return value;
}

function nextPath(feature: string, label: string, ext: string): string {
  const dir = join(runDir(), feature);
  mkdirSync(dir, { recursive: true });
  const index = String(readdirSync(dir).length + 1).padStart(2, "0");
  return join(dir, `${index}-${label}${ext}`);
}

async function get(path: string): Promise<{ status: number | null; text: string }> {
  try {
    const response = await fetch(`${WEB_URL}${path}`, { signal: AbortSignal.timeout(10_000) });
    return { status: response.status, text: await response.text() };
  }
  catch {
    return { status: null, text: "" };
  }
}

/** True when `pid` is `ancestor` or one of its descendants. */
function descendsFrom(pid: string, ancestor: string): boolean {
  let current = Number(pid);
  for (let i = 0; i < 20 && current > 1; i++) {
    if (String(current) === ancestor)
      return true;
    current = Number(sh("ps", ["-o", "ppid=", "-p", String(current)])) || 0;
  }
  return false;
}

async function doctor(): Promise<void> {
  const dir = runDir();
  const webPid = read(join(dir, "web.pid")).trim();
  const apiPid = read(join(dir, "dev-local.pid")).trim();
  const apiStdout = read(join(dir, "dev-local.stdout.log"));
  const webListeners = sh("lsof", ["-ti", "tcp:5173", "-sTCP:LISTEN"]).split(/\s+/).filter(Boolean);
  const apiListeners = sh("lsof", ["-ti", "tcp:8888", "-sTCP:LISTEN"]).split(/\s+/).filter(Boolean);
  const log = read(DEV_LOG);
  const login = await get("/login");
  const health = await get("/api/health");
  const packs = await get("/api/v1/packs");
  const client = await get("/src/api/http-client.ts");
  let packIds: string[] = [];
  try {
    packIds = (JSON.parse(packs.text) as { packs: { id: string }[] }).packs.map(pack => pack.id);
  }
  catch {}
  const checks = {
    "port 5173 has a listener started by this run's launch.sh": webListeners.length > 0 && !!webPid && webListeners.every(pid => descendsFrom(pid, webPid)),
    "port 8888 has a listener, and this run's dev:prototype is alive": apiListeners.length > 0 && !!apiPid && sh("ps", ["-o", "pid=", "-p", apiPid]) !== "",
    "API was started as dev:prototype (x-api-key check off)": apiStdout.includes("DEV READY") && apiStdout.includes("x-api-key check off"),
    "dev-local.log uses in-memory MongoDB": /MongoDB started at: mongodb:\/\/127\.0\.0\.1/.test(log),
    "GET :5173/login -> 200 with the React root": login.status === 200 && login.text.includes("id=\"root\""),
    "GET :5173/api/health -> 200 (Vite proxy reaches the API)": health.status === 200,
    "GET :5173/api/v1/packs without a key -> 200 listing diabe-teach": packs.status === 200 && packIds.includes("diabe-teach"),
    "served http-client.ts carries no VITE_API_KEY": client.status === 200 && !client.text.includes("\"VITE_API_KEY\""),
  };
  const report = {
    at: new Date().toISOString(),
    webUrl: WEB_URL,
    gitHead: sh("git", ["rev-parse", "--short", "HEAD"]),
    pids: { webNpm: webPid, webListeners, devPrototype: apiPid, apiListeners },
    statuses: { login: login.status, health: health.status, packsWithoutKey: packs.status, httpClient: client.status },
    packIds,
    checks,
    healthy: Object.values(checks).every(Boolean),
  };
  for (const [name, ok] of Object.entries(checks))
    console.log(`${ok ? "OK  " : "FAIL"} ${name}`);
  console.log(`git HEAD ${report.gitHead}; :5173 pid(s) ${webListeners.join(", ") || "none"}; :8888 pid(s) ${apiListeners.join(", ") || "none"}`);
  const file = join(dir, "web-doctor.json");
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`evidence ${file.replace(`${REPO_ROOT}/`, "")}`);
  console.log(report.healthy ? "DOCTOR HEALTHY" : "DOCTOR UNHEALTHY");
  process.exitCode = report.healthy ? 0 : 1;
}

function record(args: string[]): void {
  const [feature, label] = args;
  if (!feature || !label)
    throw new Error("usage: <stdin> | vweb.ts record <feature> <label>");
  const input = readFileSync(0, "utf8");
  let file: string;
  try {
    const value = redact(JSON.parse(input));
    file = nextPath(feature, label, ".json");
    writeFileSync(file, `${JSON.stringify({ feature, label, at: new Date().toISOString(), observed: value }, null, 2)}\n`);
  }
  catch {
    file = nextPath(feature, label, ".txt");
    writeFileSync(file, input.replace(JWT, "<redacted jwt>"));
  }
  console.log(`evidence ${file.replace(`${REPO_ROOT}/`, "")}`);
}

function keep(args: string[]): void {
  const [feature, label, source] = args;
  if (!feature || !label || !source || !existsSync(source))
    throw new Error("usage: vweb.ts keep <feature> <label> <existing screenshot file>");
  const file = nextPath(feature, label, extname(source) || ".png");
  copyFileSync(source, file);
  console.log(`evidence ${file.replace(`${REPO_ROOT}/`, "")}`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "doctor":
      await doctor();
      break;
    case "record":
      record(args);
      break;
    case "keep":
      keep(args);
      break;
    default:
      console.error("usage: vweb.ts doctor | record <feature> <label> (stdin) | keep <feature> <label> <file>");
      process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(`vweb: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
