#!/usr/bin/env node
/**
 * Starts Netlify Dev with an in-memory MongoDB instance.
 * This provides fast, reliable local testing without network dependencies.
 *
 * Prints exactly one `DEV READY http://localhost:8888` line once every
 * function in `netlify/functions/` has loaded and a real API route
 * (`GET /api/v1/packs`) answers with a non-404 status. Wait for that line
 * before running `npm run test:bdd`.
 *
 * Netlify Dev runs in its own process group; SIGINT/SIGTERM to this script
 * stops the whole group (SIGTERM, then SIGKILL after a grace period) and the
 * in-memory MongoDB. `npm run dev:local:stop` does the same from outside.
 *
 * Usage:
 *   npx tsx scripts/start-dev-with-mongodb.ts
 *   # or via npm script:
 *   npm run dev:local
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, extname } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
  curriculumPackSchema,
} from "../src/adapters/outbound/curriculum-pack.schema.js";
import { DIABE_TEACH_PACK } from "../src/domain/curriculum-pack/diabe-teach-pack.js";

const DEV_URL = "http://localhost:8888";
const READY_PROBE_PATH = "/api/v1/packs";
const READY_TIMEOUT_MS = 180_000;
const STOP_GRACE_MS = 5_000;
const FUNCTIONS_DIR = "netlify/functions";
// eslint-disable-next-line no-control-regex
const ANSI = /\x1B\[[0-9;]*m/g;

let mongod: MongoMemoryServer | null = null;
let netlifyProcess: ChildProcess | null = null;
let shuttingDown = false;
const loadedFunctions = new Set<string>();

function isShuttingDown(): boolean {
  return shuttingDown;
}

function expectedFunctions(): Set<string> {
  return new Set(
    readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
      .filter(entry => entry.isFile() && [".ts", ".js", ".mts", ".mjs"].includes(extname(entry.name)))
      .map(entry => basename(entry.name, extname(entry.name))),
  );
}

async function startMongoDB(): Promise<string> {
  console.log("🚀 Starting in-memory MongoDB...");

  mongod = await MongoMemoryServer.create({
    instance: {
      dbName: "diabe_teach_test",
    },
  });

  const uri = mongod.getUri();
  console.log(`✅ MongoDB started at: ${uri}`);

  // Seed the curriculum pack
  await seedCurriculumPack(uri);

  return uri;
}

async function seedCurriculumPack(uri: string): Promise<void> {
  console.log("📦 Seeding curriculum pack...");

  const connection = await mongoose.createConnection(uri, {
    dbName: "diabe_teach_test",
  }).asPromise();

  const PackModel = connection.model(
    CURRICULUM_PACK_MODEL_NAME,
    curriculumPackSchema,
    CURRICULUM_PACKS_COLLECTION,
  );

  const pack = DIABE_TEACH_PACK;
  const doc = {
    _id: pack.id.value,
    title: pack.title,
    version: pack.version,
    description: pack.description,
    boardConfig: pack.boardConfig,
    domains: pack.domains,
    cards: pack.cards,
    adjudicationRubric: pack.adjudicationRubric,
    assessmentInstrument: pack.assessmentInstrument,
    perceptionSurvey: pack.perceptionSurvey,
    isSystemPack: pack.isSystemPack,
    isArchived: pack.isArchived,
    createdBy: pack.createdBy,
    authorName: pack.authorName,
    createdAt: pack.createdAt,
    archivedAt: pack.archivedAt,
  };

  await PackModel.create(doc);
  await connection.close();

  console.log(`✅ Seeded pack: ${pack.title} (${pack.id.value})`);
}

/** Echoes child output and records every `Loaded function <name>` line. */
function forwardOutput(stream: NodeJS.ReadableStream | null, target: NodeJS.WriteStream): void {
  let pending = "";
  stream?.on("data", (chunk: Buffer) => {
    target.write(chunk);
    pending += chunk.toString("utf8");
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const match = /Loaded function (\S+)/.exec(line.replace(ANSI, ""));
      if (match?.[1]) {
        loadedFunctions.add(match[1]);
      }
    }
  });
}

function startNetlifyDev(mongoUri: string): void {
  console.log("🚀 Starting Netlify Dev...");

  // `detached` puts npx and everything it starts into one process group,
  // so shutdown can signal the whole tree with `process.kill(-pid)`.
  netlifyProcess = spawn("npx", ["netlify", "dev"], {
    stdio: ["inherit", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
      MONGODB_DB_NAME: "diabe_teach_test",
      // Disable reading from .env.dev.yaml for MongoDB settings
      USE_ENV_MONGODB: "true",
    },
  });
  forwardOutput(netlifyProcess.stdout, process.stdout);
  forwardOutput(netlifyProcess.stderr, process.stderr);

  netlifyProcess.on("error", (err) => {
    console.error("❌ Failed to start Netlify Dev:", err);
    void shutdown(1);
  });

  netlifyProcess.on("exit", (code) => {
    console.log(`Netlify Dev exited with code ${code}`);
    void shutdown(code ?? 0);
  });
}

async function probeStatus(): Promise<number | null> {
  try {
    const response = await fetch(`${DEV_URL}${READY_PROBE_PATH}`, {
      signal: AbortSignal.timeout(5_000),
    });
    await response.body?.cancel();
    return response.status;
  }
  catch {
    return null;
  }
}

async function waitUntilReady(): Promise<void> {
  const expected = expectedFunctions();
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!isShuttingDown() && Date.now() < deadline) {
    const allLoaded = [...expected].every(name => loadedFunctions.has(name));
    if (allLoaded) {
      const status = await probeStatus();
      if (status !== null && status !== 404) {
        console.log(`DEV READY ${DEV_URL}`);
        return;
      }
    }
    await delay(500);
  }
  if (!isShuttingDown()) {
    const missing = [...expected].filter(name => !loadedFunctions.has(name));
    console.error(`DEV NOT READY after ${READY_TIMEOUT_MS / 1000}s (functions not loaded: ${missing.join(", ") || "none"}; ${READY_PROBE_PATH} still 404 or unreachable)`);
  }
}

function signalGroup(signal: NodeJS.Signals): void {
  const pid = netlifyProcess?.pid;
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, signal);
  }
  catch {
    // The group is already gone.
  }
}

function groupAlive(): boolean {
  const pid = netlifyProcess?.pid;
  if (pid === undefined) {
    return false;
  }
  try {
    process.kill(-pid, 0);
    return true;
  }
  catch {
    return false;
  }
}

async function stopNetlifyGroup(): Promise<void> {
  signalGroup("SIGTERM");
  const deadline = Date.now() + STOP_GRACE_MS;
  while (groupAlive() && Date.now() < deadline) {
    await delay(200);
  }
  if (groupAlive()) {
    signalGroup("SIGKILL");
  }
}

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log("\n🧹 Cleaning up...");

  await stopNetlifyGroup();

  if (mongod) {
    await mongod.stop();
    console.log("✅ MongoDB stopped");
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("SIGHUP", () => void shutdown(0));

async function main(): Promise<void> {
  try {
    const mongoUri = await startMongoDB();
    startNetlifyDev(mongoUri);
    await waitUntilReady();
  }
  catch (err) {
    console.error("❌ Failed to start:", err);
    await shutdown(1);
  }
}

void main();
