# Issue 04: Simplify HTTP Client to Use Base URL

**Status:** resolved

Resolved 2026-11-20: done (`netlify-cli` devDependency, `netlify.toml` `[dev]` block and URL-based `tests/integration/support/http-client.ts` in `b368e85`; `dev:local`/`test:bdd` scripts, `BeforeAll` health check in `tests/integration/support/hooks.ts`; no Express in `package.json`).

## Task

Remove Express dependency from HTTP client and use supertest with base URL directly.

## Changes to `tests/integration/support/http-client.ts`

Replace Express-based implementation with URL-based:

```typescript
import type { Response } from "supertest";
import request from "supertest";

const BASE_URL = process.env.NETLIFY_DEV_URL || "http://localhost:8888";

function toApiGatewayResult(res: Response) {
  return {
    statusCode: res.status,
    headers: res.headers as Record<string, string>,
    body: typeof res.body === "object" ? JSON.stringify(res.body) : res.text,
  };
}

export async function createSession(body: {
  packId: string;
  mode: "solo" | "classroom" | "study-rct";
  adjudicationMode: "ai" | "peer-instructor" | "hybrid";
  creatorDisplayName?: string;
}) {
  const res = await request(BASE_URL)
    .post("/api/v1/sessions")
    .set("Content-Type", "application/json")
    .send(body);

  return toApiGatewayResult(res);
}

// Update all other functions similarly - remove Express app parameter
```

## Files to Delete

- `tests/integration/support/test-server.ts` - No longer needed

## Acceptance Criteria

- [ ] No Express imports in http-client.ts
- [ ] All HTTP functions use `request(BASE_URL)` instead of `request(app)`
- [ ] `test-server.ts` deleted
- [ ] TypeScript compiles without errors

## Notes

- Supertest supports both Express app instances AND base URLs
- This is the key simplification - one less abstraction layer
