# 00: The API marks System Packs (`isSystemPack`)

**What to build:** A teacher's Pack Library and Pack Detail can tell which packs are built-in System Packs, so the web app hides Archive and "save as new version" on them instead of waiting for a 403. Add a required boolean `isSystemPack` to each item of `GET /api/v1/packs` and to the pack of `GET /api/v1/packs/{packId}`, true exactly when the server would refuse archiving or a new version with `PACK_IS_SYSTEM_PACK`. Contract (`docs/api/openapi.yaml`), domain/application/outbound code, handler tests, the Bruno docs and the BDD pack feature follow. Hexagonal layers per `docs/agents/api-architecture.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decided by the user on 2026-11-27** (react-web-ui spec, open question (a)).

- [ ] Handler tests: the list and detail report `isSystemPack: true` for a System Pack and `false` for a teacher's pack; the value comes from the same rule that produces 403 `PACK_IS_SYSTEM_PACK`.
- [ ] `docs/api/openapi.yaml` lists the field as required on `CurriculumPackListItem` and the pack-by-id response; the contract tests pass.
- [ ] Bruno docs and drift test updated.
- [ ] BDD pack feature asserts the flag (run alone against `dev:local`).
- [ ] typecheck, vitest, lint, lint:boundaries (no new errors) clean.
