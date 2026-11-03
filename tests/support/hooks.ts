import type { TestWorld } from "./world.js";
import { After, Before, BeforeAll, AfterAll } from "@cucumber/cucumber";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import {
  clearTestDatabase,
  startMongoTestServer,
  stopMongoTestServer,
} from "./mongo-test-server.js";

const useMongoDb = process.env.BDD_USE_MONGODB === "true";

BeforeAll(async function () {
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
    // TODO: Replace with Mongo-backed repositories when available
    this.deps = {
      packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
      sessionRepo: new InMemoryGameSessionRepository(),
      tokenAdapter: new FakeCapabilityTokenAdapter(),
    };
  }
  else {
    this.deps = {
      packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
      sessionRepo: new InMemoryGameSessionRepository(),
      tokenAdapter: new FakeCapabilityTokenAdapter(),
    };
  }
});

After(async function (this: TestWorld) {
  // Cleanup can be extended as needed
});
