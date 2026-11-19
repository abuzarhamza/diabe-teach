# 08: Refused archive or unarchive returns the right error when served by Netlify

**What to build:** Archiving or unarchiving a pack that can't be archived returns the documented error when served by `netlify dev`, the same as in the handler tests:
- a System Pack gets 403 `PACK_IS_SYSTEM_PACK`;
- an unknown pack gets 404 `PACK_NOT_FOUND`;
- archiving an already archived pack, or unarchiving one that isn't archived, gets 409.

As of `93dbb3f`, the ticket 07 agent saw these refusals come back as **400 `MISSING_PACK_ID`** under `npm run dev:prototype`, while archiving a normal pack worked. The handler reads `event.pathParameters.packId`. Handler tests set that field directly, so they never exercise how Netlify Functions v2 passes route parameters (`config.path` `:packId` → `context.params`) through the lambda wrapper. Find out why the error paths lose the parameter. The fix should come from the real request path, and should cover every `:param` route (pack by id, archive, unarchive). The error body must use the standard `{ code, message }` shape; as of `e25a7a1` these routes still return `{ error: { code } }`.

See spec: `.scratch/teacher-login/spec.md`. Found in the ticket 07 report (2026-11-19).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A BDD scenario (it runs through `netlify dev`): archiving the System Pack gets 403 `PACK_IS_SYSTEM_PACK`, and archiving an unknown pack id gets 404, each with a `{ code, message }` body
- [ ] A BDD scenario: archive, archive again (409), unarchive, unarchive again (409)
- [ ] Handler tests build events the way the v2 wrapper does, so a missing route parameter would fail them
- [ ] `GET /api/v1/packs/{packId}` checked the same way
- [ ] The API overlay's friction note on this is removed
- [ ] Typecheck, vitest, BDD, lint (96) and boundaries (6) are no worse
