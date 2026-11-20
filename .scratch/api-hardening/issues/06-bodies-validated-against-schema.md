# 06: Missing or wrongly typed fields return 400 naming the field

**What to build:** A body that is valid JSON but breaks its route's request schema (a missing required field, a wrong type, an unknown enum value) gets **400 `INVALID_REQUEST_BODY`** with `details.field` (the JSON path) and `details.reason` (short and safe, for example "is required" or "must be one of …"), never a 500. One Ajv step in `createApiHandler` does this: it runs after auth and the JSON object check, uses the generated schema for the route's declared operationId, and is skipped for routes with no body. Domain rules keep their own codes (422 `PACK_VALIDATION_FAILED`, 422 `CHAIN_TOPOLOGY_INVALID`, 409 phase errors). Raw Ajv text is never passed through.

See spec: `.scratch/api-hardening/spec.md`. Supersedes api-hardening 02.

**Blocked by:** 05 (Request schemas are generated from openapi.yaml)

**Status:** ready-for-agent

- [ ] Handler tests: join with no `roomCode`, or a non-string one, returns 400 naming `roomCode`
- [ ] Handler tests: create-session with an unknown `mode` or `adjudicationMode`, and transition or adjudicate with a missing or unknown `action`, return 400 naming the field
- [ ] A parameterised test over every documented write route: removing each required field returns 400 naming it, never 500
- [ ] On token-protected routes, a bad body with no token still returns 401
- [ ] No 400 body contains a stack trace, a file path or raw Ajv wording
- [ ] Every route declares its operationId to `createApiHandler`, so a new route is validated automatically
- [ ] The API overlay catalog's matching deviation lines are removed
- [ ] BDD: join with no room code returns 400 through `netlify dev`
- [ ] Typecheck, vitest, BDD (one feature per process), lint and boundaries are no worse
