# Spec: Local Integration Testing with Netlify Dev, Supertest & Cucumber.js

Status: ready-for-agent

## Problem Statement

The current Cucumber.js BDD integration tests use an Express wrapper (`tests/integration/support/test-server.ts`) to expose Netlify function handlers via supertest. This approach:

1. **Diverges from Production Runtime**: The Express adapter simulates handler invocation but doesn't exercise the actual Netlify Functions runtime, routing, or middleware pipeline as deployed.
2. **Maintains Parallel Infrastructure**: Two codebases (Express wrapper + Netlify functions) must be kept in sync, creating maintenance burden.
3. **False Confidence**: Tests passing against Express don't guarantee production behavior.

Developers need integration tests that run against the actual Netlify runtime to ensure tests validate real production behavior.

## Solution

**Remove the Express wrapper entirely** and run all integration tests against `netlify dev`:

1. **Install Netlify CLI**: Add `@netlify/cli` for local Netlify Functions emulation.
2. **Configure `netlify.toml`**: Add `[dev]` block with test-appropriate settings.
3. **Simplify HTTP Client**: Use supertest with base URL `http://localhost:8888` instead of Express app instance.
4. **Remove Express Dependencies**: Delete `test-server.ts` and remove `express` from devDependencies.
5. **Test Composition Root**: Create a test-mode configuration for repository isolation.

## User Stories

1. As a backend developer, I want to run `npm run dev` to start a local Netlify server that mirrors production behavior.
2. As a backend developer, I want integration tests to hit real HTTP endpoints at `http://localhost:8888/api/v1/*` so tests validate actual routing and middleware.
3. As a QA engineer, I want `npm run test:bdd` to test against the real Netlify runtime, not a mock server.
4. As a developer, I want to remove the Express test wrapper so there's only one way to run the API locally.
5. As a developer, I want test repositories to be isolated per test run so tests don't pollute each other.
6. As a CI/CD pipeline, I want a script that starts `netlify dev`, waits for readiness, runs tests, then shuts down cleanly.
7. As a backend developer, I want `npm run test:bdd:mongodb` to continue working for database integration tests against the real server.
8. As a developer debugging tests, I want `DEBUG=* netlify dev` to show request/response details.
9. As a release engineer, I want integration tests to catch routing misconfigurations that Express mocks would miss.
10. As a developer, I want clear error messages when `netlify dev` isn't running before tests start.

## Implementation Decisions

### Package Changes

**Install:**
- `@netlify/cli` - Local Netlify Functions emulation

**Remove:**
- `express` - No longer needed
- `@types/express` - No longer needed

**Keep:**
- `supertest` - Works with base URLs, not just Express apps
- `@types/supertest` - Type definitions

### `netlify.toml` Configuration

```toml
[dev]
  port = 8888
  functionsPort = 9999
  autoLaunch = false
  framework = "#custom"

[context.dev.environment]
  NODE_ENV = "development"
  TEST_MODE = "true"
```

### Simplified HTTP Client

Replace Express-based client with URL-based client:

```typescript
// tests/integration/support/http-client.ts
import request from "supertest";

const BASE_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";

export async function createSession(body: {...}) {
  const res = await request(BASE_URL)
    .post("/api/v1/sessions")
    .set("Content-Type", "application/json")
    .send(body);
  return toApiGatewayResult(res);
}
```

### Files to Delete

- `tests/integration/support/test-server.ts` - Express wrapper no longer needed

### Files to Modify

- `tests/integration/support/http-client.ts` - Remove Express dependency, use base URL
- `tests/integration/support/world.ts` - Remove `app: Express` property
- `tests/integration/support/hooks.ts` - Remove Express app creation, add server health check
- `tests/integration/step-definitions/*.ts` - Remove `this.app` parameter from calls

### NPM Scripts

```json
{
  "scripts": {
    "dev": "netlify dev",
    "dev:debug": "DEBUG=* netlify dev",
    "pretest:bdd": "node scripts/wait-for-netlify-dev.js",
    "test:bdd": "node --import tsx node_modules/@cucumber/cucumber/bin/cucumber.js --config tests/cucumber.mjs",
    "test:bdd:mongodb": "BDD_USE_MONGODB=true npm run test:bdd"
  }
}
```

### Test Repository Isolation

For test isolation, the Netlify functions should detect `TEST_MODE=true` and use in-memory repositories:

```typescript
// In function composition root
const isTestMode = process.env.TEST_MODE === "true";

const sessionRepo = isTestMode
  ? new InMemoryGameSessionRepository()
  : new MongoGameSessionRepository(connection);
```

Alternatively, expose a test reset endpoint:
- `POST /api/v1/__test__/reset` - Clears in-memory repositories between scenarios

### Wait-for-Server Script

Create `scripts/wait-for-netlify-dev.js`:

```javascript
import http from "http";

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;
const URL = "http://localhost:8888";

async function waitForServer() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await fetch(URL);
      console.log("✓ Netlify dev server ready");
      process.exit(0);
    } catch {
      console.log(`Waiting for server... (${i + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
  console.error("✗ Netlify dev server not responding");
  process.exit(1);
}

waitForServer();
```

## Testing Decisions

### Testing Seam

- **Single seam**: HTTP interface at `http://localhost:8888/api/v1/*`
- Tests exercise the full Netlify Functions stack: routing, middleware, handlers

### Test Isolation Strategy

Two options (choose one):

**Option A: Test Mode Flag**
- Functions detect `TEST_MODE=true` and use in-memory repositories
- Cucumber `Before` hook calls reset endpoint or repositories are fresh per server restart

**Option B: MongoDB Memory Server**
- `netlify dev` connects to `mongodb-memory-server` instance started in `BeforeAll`
- Pass connection string via environment variable

Recommend **Option A** for simplicity - matches current in-memory approach.

### Prior Art

- Current Cucumber.js tests serve as template
- Supertest HTTP assertions remain unchanged
- Only the transport layer changes (Express → HTTP)

## Out of Scope

- Modifying domain logic or use cases
- Adding new test scenarios
- Production deployment changes
- Scheduled function testing
- Edge Functions

## Further Notes

- **Research Reference**: [`.scratch/netlify-local-dev-research/findings.md`](../netlify-local-dev-research/findings.md)
- **Key Simplification**: One way to run the API locally (`netlify dev`), one way to test it (supertest against that server)
- **Trade-off**: Tests are slower (~2-5s vs ~0.1s) but more realistic
- **CI/CD**: May need to start `netlify dev` in background, wait, run tests, then kill
