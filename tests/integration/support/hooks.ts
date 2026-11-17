import type { TestWorld } from "./world.js";
import { After, Before, BeforeAll, AfterAll, setDefaultTimeout } from "@cucumber/cucumber";

// Increase default timeout for MongoDB operations
setDefaultTimeout(30000);
import { FakeCapabilityTokenAdapter } from "../../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../../src/domain/curriculum-pack/diabe-teach-pack.js";
import {
  clearTestDatabase,
  startMongoTestServer,
  stopMongoTestServer,
} from "./mongo-test-server.js";

const BASE_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";
const useMongoDb = process.env.BDD_USE_MONGODB === "true";

async function checkNetlifyServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(BASE_URL, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    // 404 is fine - server is up, just no route at root
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

BeforeAll(async function () {
  // Check Netlify dev server is running
  const isRunning = await checkNetlifyServer();
  if (!isRunning) {
    console.error("\n" + "=".repeat(60));
    console.error("  Netlify dev server is not running!");
    console.error("");
    console.error("  Start it in another terminal:");
    console.error("    $ npm run dev");
    console.error("");
    console.error("  Then run tests again:");
    console.error("    $ npm run test:bdd");
    console.error("=".repeat(60) + "\n");
    process.exit(1);
  }
  console.log(`  Netlify dev server detected at ${BASE_URL}`);

  if (useMongoDb) {
    await startMongoTestServer();
  }
});

AfterAll(async function () {
  if (useMongoDb) {
    await stopMongoTestServer();
  }
});

Before(async function (this: TestWorld) {
  this.reset();

  if (useMongoDb) {
    await clearTestDatabase();
  }

  // Note: These deps are for reference/type compatibility
  // The actual repositories are in the running Netlify functions
  this.deps = {
    packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
    sessionRepo: new InMemoryGameSessionRepository(),
    tokenAdapter: new FakeCapabilityTokenAdapter(),
  };
});

After(async function (this: TestWorld) {
  // Cleanup can be extended as needed
});
