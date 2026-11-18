# Issue 06: Add Server Health Check in BeforeAll Hook

## Task

Add a health check in the `BeforeAll` hook to verify the Netlify dev server is running before tests start.

## Changes to `tests/integration/support/hooks.ts`

```typescript
import type { TestWorld } from "./world.js";
import { After, Before, BeforeAll, AfterAll } from "@cucumber/cucumber";
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
    const response = await fetch(BASE_URL, { method: "HEAD" });
    return response.ok || response.status === 404; // 404 is fine, server is up
  } catch {
    return false;
  }
}

BeforeAll(async function () {
  // Check Netlify dev server is running
  const isRunning = await checkNetlifyServer();
  if (!isRunning) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ Netlify dev server is not running!");
    console.error("");
    console.error("   Start it in another terminal:");
    console.error("   $ npm run dev");
    console.error("");
    console.error("   Then run tests again:");
    console.error("   $ npm run test:bdd");
    console.error("=".repeat(60) + "\n");
    process.exit(1);
  }
  console.log(`✓ Netlify dev server detected at ${BASE_URL}`);

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

  // Note: In Netlify dev mode, these deps are used for reference only
  // The actual repositories are in the running Netlify functions
  if (useMongoDb) {
    await clearTestDatabase();
  }

  this.deps = {
    packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
    sessionRepo: new InMemoryGameSessionRepository(),
    tokenAdapter: new FakeCapabilityTokenAdapter(),
  };
});

After(async function (this: TestWorld) {
  // Cleanup can be extended as needed
});
```

## Remove Express App Creation

Delete all references to:
- `createTestApp()`
- `this.app`

## Update World.ts

Remove the `app` property:

```typescript
export class TestWorld extends World {
  public deps!: TestDependencies;
  // Remove: public app!: Express;

  public currentSessionId: string | null = null;
  // ... rest unchanged
}
```

## Acceptance Criteria

- [ ] Clear error message when Netlify server not running
- [ ] Tests exit with code 1 if server not available
- [ ] Success message when server detected
- [ ] No Express references in hooks.ts or world.ts
