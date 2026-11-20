# 09: The OpenAPI contract matches the code

**What to build:** `docs/api/openapi.yaml` stops disagreeing with the running API:
- `validateCurriculumPack` documents `{ valid, errors, warnings }` with `{ path, code, message }` items, and its 400 for a pack with a missing or wrongly typed field;
- `getGameSessionState` and `getRoundStandings` declare `BearerAuth` with 401/403;
- `streamGameSessionEvents` is marked not implemented (`x-implemented: false`, with a description pointing to polling);
- `jump` is documented as next-phase only, with ending early going through the end route.

Regenerate the request schemas, and update the matching prototype catalog deviations.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Each point above is reflected in `openapi.yaml`
- [ ] Request-schema staleness test and catalog drift and sample tests pass
- [ ] The prototype catalog's deviations for these points are removed or reworded
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
