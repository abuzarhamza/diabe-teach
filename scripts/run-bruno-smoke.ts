#!/usr/bin/env node
/**
 * Runs the entire Bruno collection (`docs/api/bruno/01-Health` through
 * `06-Assessments-Survey-and-Lifecycle`) top-to-bottom via `@usebruno/cli`
 * (`bru run -r --env "Local Dev"`).
 *
 * Needs a running dev server (`npm run dev:local` or `npm run dev:prototype`).
 * Before launching Bruno CLI, waits up to 15s for `GET /api/health` to answer
 * 200, and exits with a clear message if no server is listening on port 8888.
 */

import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { AppRuntime } from "../src/app-runtime.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTION_DIR = join(REPO_ROOT, "docs/api/bruno");
const BRU_BIN = join(REPO_ROOT, "node_modules/@usebruno/cli/bin/bru.js");
const DEV_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";
const READY_WAIT_MS = 15_000;

async function waitForDevServer(): Promise<boolean> {
  const deadline = Date.now() + READY_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${DEV_URL}/api/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      await response.body?.cancel();
      if (response.status === 200) {
        return true;
      }
    }
    catch {
      // Server not listening yet.
    }
    await delay(500);
  }
  return false;
}

async function main(): Promise<void> {
  if (!(await waitForDevServer())) {
    console.error(`Dev server at ${DEV_URL} is not running (/api/health unreachable after ${READY_WAIT_MS / 1000}s).`);
    console.error("Start it with `npm run dev:local` (or `npm run dev:prototype`), wait for `DEV READY`, then run `npm run test:bruno`.");
    process.exitCode = 1;
    return;
  }

  const envConfig = AppRuntime.loadEnvConfig();
  const apiKey = envConfig.apiKey || "dev-local-api-key";

  execFileSync(
    process.execPath,
    [
      BRU_BIN,
      "run",
      "-r",
      "--env",
      "Local Dev",
      "--env-var",
      `baseUrl=${DEV_URL}`,
      "--env-var",
      `apiKey=${apiKey}`,
    ],
    {
      cwd: COLLECTION_DIR,
      stdio: "inherit",
    },
  );
}

void main();
