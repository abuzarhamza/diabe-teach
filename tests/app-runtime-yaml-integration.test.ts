import { describe, expect, it } from "vitest";
import { CurriculumPackSeeder } from "../scripts/seed-curriculum-packs.js";
import { AppRuntime } from "../src/app-runtime.js";

describe("appRuntime and Seeder Integration with .env.dev.yaml (Ticket 02)", () => {
  it("merges .env.dev.yaml values into AppRuntime.loadEnvConfig when process.env does not override", () => {
    // When process.env is empty, AppRuntime should load from local .env.dev.yaml if present
    const loaded = AppRuntime.loadEnvConfig({});

    // .env.dev.yaml in project root specifies database: "concept_chain_dev"
    expect(loaded.mongoDbName).toBe("concept_chain_dev");
    expect(loaded.mongoUri).toContain("mongodb+srv://");
    expect(loaded.capabilityTokenSecret).toBeDefined();
    expect(loaded.apiKey).toBeDefined();
  });

  it("prioritizes process.env values over .env.dev.yaml", () => {
    const loaded = AppRuntime.loadEnvConfig({
      MONGODB_URI: "mongodb://override-uri:27017",
      MONGODB_DB_NAME: "override_db",
      CAPABILITY_TOKEN_SECRET: "override-secret",
      API_KEY: "override-api-key",
    });

    expect(loaded.mongoUri).toBe("mongodb://override-uri:27017");
    expect(loaded.mongoDbName).toBe("override_db");
    expect(loaded.capabilityTokenSecret).toBe("override-secret");
    expect(loaded.apiKey).toBe("override-api-key");
  });

  it("curriculumPackSeeder resolves config via AppRuntime when no explicit options are provided", () => {
    // Test that CurriculumPackSeeder resolveOptions returns the loaded .env.dev.yaml config
    const resolved = CurriculumPackSeeder.resolveOptions();

    expect(resolved.dbName).toBe("concept_chain_dev");
    expect(resolved.mongoUri).toContain("mongodb+srv://");
  });
});
