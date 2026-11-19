#!/usr/bin/env node
/**
 * Runs the Cucumber BDD features one at a time: each feature file gets its own
 * cucumber process, and the next starts only after the previous one exits.
 * Nothing runs in parallel, which keeps memory and CPU use low on dev machines.
 *
 * Usage:
 *   npm run test:bdd                                   # every feature, in name order
 *   npm run test:bdd -- tests/integration/features/survey-journey.feature
 *
 * Needs a running dev server (`npm run dev:local` recommended: in-memory MongoDB).
 * Before any feature runs, it waits (up to 60s) for `GET /api/v1/packs` to
 * answer with a non-404 status, the same check behind `dev:local`'s
 * `DEV READY` line, and stops with a clear message if it never does.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const FEATURES_DIR = "tests/integration/features";
const CUCUMBER_BIN = "node_modules/@cucumber/cucumber/bin/cucumber.js";
const DEV_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";
const READY_PROBE_PATH = "/api/v1/packs";
const READY_WAIT_MS = 60_000;

interface FeatureResult {
  readonly feature: string;
  readonly passed: boolean;
  readonly seconds: number;
}

function listFeatures(args: readonly string[]): string[] {
  if (args.length > 0) {
    return [...args];
  }
  return readdirSync(FEATURES_DIR)
    .filter(name => name.endsWith(".feature"))
    .sort()
    .map(name => join(FEATURES_DIR, name));
}

function runFeature(feature: string): FeatureResult {
  console.log(`\n▶ ${feature}`);
  const started = Date.now();
  const result = spawnSync(
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
    { stdio: "inherit", env: process.env },
  );
  return {
    feature,
    passed: result.status === 0,
    seconds: Math.round((Date.now() - started) / 1000),
  };
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
  if (!(await devServerReady())) {
    console.error(`Dev server at ${DEV_URL} is not ready (${READY_PROBE_PATH} unreachable or 404 after ${READY_WAIT_MS / 1000}s).`);
    console.error("Start it with `npm run dev:local`, wait for the `DEV READY` line, then rerun `npm run test:bdd`.");
    process.exitCode = 1;
    return;
  }
  const features = listFeatures(process.argv.slice(2));
  const results: FeatureResult[] = [];
  for (const feature of features) {
    results.push(runFeature(feature));
  }

  console.log("\nBDD features (run one at a time):");
  for (const r of results) {
    console.log(`  ${r.passed ? "✔" : "✘"} ${relative(FEATURES_DIR, r.feature)} (${r.seconds}s)`);
  }
  const failed = results.filter(r => !r.passed).length;
  console.log(`${results.length - failed} passed, ${failed} failed`);
  process.exitCode = failed > 0
    ? 1
    : 0;
}

void main();
