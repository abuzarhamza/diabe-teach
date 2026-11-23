#!/usr/bin/env node
/**
 * Runs the Cucumber BDD features one at a time: each feature file gets its own
 * cucumber process, and the next starts only after the previous one exits.
 * Nothing runs in parallel, which keeps memory and CPU use low on dev machines.
 *
 * Usage:
 *   npm run test:bdd                                   # every feature, in name order
 *   npm run test:bdd survey-journey                    # bare feature name
 *   npm run test:bdd survey-journey.feature            # file name
 *   npm run test:bdd tests/integration/features/survey-journey.feature
 *
 * Each argument must resolve to an existing `.feature` file; a bare name maps to
 * `tests/integration/features/<name>.feature`. An argument that matches nothing
 * stops the run before anything is spawned, listing the available features.
 * A feature whose cucumber run executes 0 scenarios counts as failed.
 *
 * Needs a running dev server (`npm run dev:local` recommended: in-memory MongoDB).
 * Before any feature runs, it waits (up to 60s) for `GET /api/v1/packs` to
 * answer with a non-404 status, the same check behind `dev:local`'s
 * `DEV READY` line, and stops with a clear message if it never does.
 *
 * Before each feature it checks `GET /api/health` (200 within 10s). If the
 * server stopped answering, the run stops there: the remaining features are
 * reported as not run, with a pointer to the server log.
 *
 * Each feature has a time limit (default 5 minutes; override with
 * `BDD_FEATURE_TIMEOUT_MS`). A feature that runs past it is killed and counted
 * as failed, and the runner points at the server log (`.netlify/dev-local.log`,
 * written by `npm run dev:local`), instead of waiting on a hung request.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const FEATURES_DIR = "tests/integration/features";
const CUCUMBER_BIN = "node_modules/@cucumber/cucumber/bin/cucumber.js";
const DEV_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";
const READY_PROBE_PATH = "/api/v1/packs";
const READY_WAIT_MS = 60_000;
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 10_000;
const FEATURE_TIMEOUT_MS = Number(process.env.BDD_FEATURE_TIMEOUT_MS) || 5 * 60_000;
const KILL_GRACE_MS = 5_000;
const SERVER_LOG = ".netlify/dev-local.log";

interface FeatureResult {
  readonly feature: string;
  readonly outcome: "passed" | "failed" | "timed out" | "not run";
  readonly seconds: number;
}

interface CucumberRun {
  readonly status: number | null;
  readonly output: string;
  readonly timedOut: boolean;
}

function availableFeatures(): string[] {
  return readdirSync(FEATURES_DIR)
    .filter(name => name.endsWith(".feature"))
    .sort()
    .map(name => join(FEATURES_DIR, name));
}

/** Maps an argument (bare name, file name or path) to an existing feature file, or undefined. */
function resolveFeature(arg: string): string | undefined {
  const fileName = arg.endsWith(".feature")
    ? arg
    : `${arg}.feature`;
  const candidates = [
    arg,
    join(FEATURES_DIR, fileName),
  ];
  return candidates.find(candidate => candidate.endsWith(".feature") && existsSync(candidate));
}

/** Resolves every argument, or returns the ones that match no feature file. */
function listFeatures(args: readonly string[]): { features: string[]; unknown: string[] } {
  if (args.length === 0) {
    return {
      features: availableFeatures(),
      unknown: [],
    };
  }
  const features: string[] = [];
  const unknown: string[] = [];
  for (const arg of args) {
    const feature = resolveFeature(arg);
    if (feature === undefined) {
      unknown.push(arg);
    }
    else {
      features.push(feature);
    }
  }
  return { features, unknown };
}

/** Reads the scenario count from cucumber's summary line ("3 scenarios (3 passed)"). */
function scenarioCount(output: string): number {
  const match = /^(\d+) scenarios?\b/m.exec(output);
  return match
    ? Number(match[1])
    : 0;
}

/** Runs one cucumber process, killing it if it runs past FEATURE_TIMEOUT_MS. */
async function runCucumber(feature: string): Promise<CucumberRun> {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      CUCUMBER_BIN,
      "--config",
      "tests/cucumber.mjs",
      "--profile",
      "single",
      feature,
    ],
    // stdout is captured (and echoed as it arrives) so the summary's scenario count can be read.
    {
      stdio: ["inherit", "pipe", "inherit"],
      env: process.env,
    },
  );
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
    process.stdout.write(chunk);
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
  }, FEATURE_TIMEOUT_MS);
  const status = await new Promise<number | null>((resolve) => {
    child.on("close", code => resolve(code));
  });
  clearTimeout(timer);
  return { status, output, timedOut };
}

async function runFeature(feature: string): Promise<FeatureResult> {
  console.log(`\n▶ ${feature}`);
  const started = Date.now();
  const run = await runCucumber(feature);
  const seconds = Math.round((Date.now() - started) / 1000);
  if (run.timedOut) {
    console.error(`✘ ${feature} did not finish within ${FEATURE_TIMEOUT_MS / 1000}s and was stopped.`);
    console.error(`  A request is probably hanging in the dev server; see ${SERVER_LOG} (written by \`npm run dev:local\`).`);
    return { feature, outcome: "timed out", seconds };
  }
  const scenarios = scenarioCount(run.output);
  if (scenarios === 0) {
    console.error(`✘ ${feature} ran 0 scenarios; counting it as failed.`);
  }
  const passed = run.status === 0 && scenarios > 0;
  if (!passed) {
    console.error(`  Server-side errors, if any, are in ${SERVER_LOG}.`);
  }
  return {
    feature,
    outcome: passed
      ? "passed"
      : "failed",
    seconds,
  };
}

/** True when the health route answers 200 within HEALTH_TIMEOUT_MS. */
async function devServerHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${DEV_URL}${HEALTH_PATH}`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.status === 200;
  }
  catch {
    return false;
  }
}

async function devServerReady(): Promise<boolean> {
  const deadline = Date.now() + READY_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${DEV_URL}${READY_PROBE_PATH}`, {
        signal: AbortSignal.timeout(5_000),
      });
      await response.body?.cancel();
      if (response.status !== 404) {
        return true;
      }
    }
    catch {
      // Not listening yet.
    }
    await delay(1_000);
  }
  return false;
}

async function main(): Promise<void> {
  const { features, unknown } = listFeatures(process.argv.slice(2));
  if (unknown.length > 0) {
    console.error(`No feature file matches: ${unknown.join(", ")}`);
    console.error("Available features (pass a bare name, a file name, or a path):");
    for (const feature of availableFeatures()) {
      console.error(`  ${relative(FEATURES_DIR, feature).replace(/\.feature$/, "")}`);
    }
    process.exitCode = 1;
    return;
  }
  if (!(await devServerReady())) {
    console.error(`Dev server at ${DEV_URL} is not ready (${READY_PROBE_PATH} unreachable or 404 after ${READY_WAIT_MS / 1000}s).`);
    console.error("Start it with `npm run dev:local`, wait for the `DEV READY` line, then rerun `npm run test:bdd`.");
    process.exitCode = 1;
    return;
  }
  const results: FeatureResult[] = [];
  let serverDown = false;
  for (const feature of features) {
    if (!serverDown && !(await devServerHealthy())) {
      serverDown = true;
      console.error(`\n✘ Dev server at ${DEV_URL} failed its health check (${HEALTH_PATH} not 200 within ${HEALTH_TIMEOUT_MS / 1000}s); stopping before ${feature}.`);
      console.error(`  See ${SERVER_LOG}, then restart it: \`npm run dev:local:stop && npm run dev:local\`.`);
    }
    results.push(serverDown
      ? { feature, outcome: "not run", seconds: 0 }
      : await runFeature(feature));
  }

  console.log("\nBDD features (run one at a time):");
  for (const r of results) {
    const mark = r.outcome === "passed"
      ? "✔"
      : "✘";
    const note = r.outcome === "passed" || r.outcome === "failed"
      ? `${r.seconds}s`
      : r.outcome;
    console.log(`  ${mark} ${relative(FEATURES_DIR, r.feature)} (${note})`);
  }
  const passed = results.filter(r => r.outcome === "passed").length;
  const failed = results.length - passed;
  console.log(`${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0
    ? 1
    : 0;
}

void main();
