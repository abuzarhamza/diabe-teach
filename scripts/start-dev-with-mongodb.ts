#!/usr/bin/env node
/**
 * Starts Netlify Dev with an in-memory MongoDB instance.
 * This provides fast, reliable local testing without network dependencies.
 *
 * Usage:
 *   npx tsx scripts/start-dev-with-mongodb.ts
 *   # or via npm script:
 *   npm run dev:local
 */

import { spawn } from "node:child_process";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { DIABE_TEACH_PACK } from "../src/domain/curriculum-pack/diabe-teach-pack.js";
import {
  curriculumPackSchema,
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
} from "../src/adapters/outbound/curriculum-pack.schema.js";

let mongod: MongoMemoryServer | null = null;
let netlifyProcess: ReturnType<typeof spawn> | null = null;

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

function startNetlifyDev(mongoUri: string): void {
  console.log("🚀 Starting Netlify Dev...");

  netlifyProcess = spawn("npx", ["netlify", "dev"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
      MONGODB_DB_NAME: "diabe_teach_test",
      // Disable reading from .env.dev.yaml for MongoDB settings
      USE_ENV_MONGODB: "true",
    },
  });

  netlifyProcess.on("error", (err) => {
    console.error("❌ Failed to start Netlify Dev:", err);
    cleanup();
    process.exit(1);
  });

  netlifyProcess.on("exit", (code) => {
    console.log(`Netlify Dev exited with code ${code}`);
    cleanup();
    process.exit(code ?? 0);
  });
}

async function cleanup(): Promise<void> {
  console.log("\n🧹 Cleaning up...");

  if (netlifyProcess && !netlifyProcess.killed) {
    netlifyProcess.kill("SIGTERM");
  }

  if (mongod) {
    await mongod.stop();
    console.log("✅ MongoDB stopped");
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

async function main(): Promise<void> {
  try {
    const mongoUri = await startMongoDB();
    startNetlifyDev(mongoUri);
  } catch (err) {
    console.error("❌ Failed to start:", err);
    await cleanup();
    process.exit(1);
  }
}

main();
