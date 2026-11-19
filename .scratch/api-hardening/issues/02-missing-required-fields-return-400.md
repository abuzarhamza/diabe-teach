# 02: Missing or wrongly typed required fields return 400, not 500

**What to build:** A request body that is valid JSON but is missing a required field, or has a field of the wrong type, gets **400 `INVALID_REQUEST_BODY`** naming the field (`details.field`), never a 500. As of `bcab708`, `POST /api/v1/sessions/join` with `{}` returns 500 `INTERNAL_ERROR` (no stack, thanks to api-hardening 01). Claude checked this against `dev:local` on 2026-11-19. The API overlay catalog lists similar unvalidated fields: `mode` and `adjudicationMode` on create-session, and `action` on transition and adjudicate.

Prefer one schema-driven check (ADR-0005: a well-known validator, ideally fed by the request schemas already in `docs/api/openapi.yaml`) over hand-written checks in each handler, so that new routes get it for free.

**Blocked by:** None (api-hardening 01, `bcab708`, is done)

**Status:** ready-for-agent

- [ ] Handler test: join with no `roomCode`, or a non-string one, returns 400 naming `roomCode`
- [ ] Handler tests: create-session with an unknown `mode` or `adjudicationMode`, and transition or adjudicate with a missing or unknown `action`, return 400 naming the field
- [ ] No route returns 500 for any body that is valid JSON but breaks its OpenAPI request schema (a parameterised test over the documented write routes)
- [ ] The API overlay catalog's matching deviation lines are removed
- [ ] Typecheck, vitest, BDD, lint (96) and boundaries (6) are no worse
