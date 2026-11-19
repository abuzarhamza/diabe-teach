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
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const FEATURES_DIR = "tests/integration/features";
const CUCUMBER_BIN = "node_modules/@cucumber/cucumber/bin/cucumber.js";

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

function main(): void {
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

main();
