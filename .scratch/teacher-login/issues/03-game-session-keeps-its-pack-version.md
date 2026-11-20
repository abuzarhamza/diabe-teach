# 03: A running Game Session keeps the Pack Version it started with

**What to build:** When a Game Session is created, it records the **Pack Version** of its Curriculum Pack (the latest version at that moment). Everything that reads the pack for that session uses the pinned version, even if someone registers a newer one while the class is running: the board deal, Pretest and Posttest Assessment Attempts, and the perception survey. The curriculum pack repository gains a lookup by pack id **and** version. The existing latest-version lookup stays for Game setup and direct pack reads.

The version is persisted in MongoDB. Game Sessions stored before this change have no pinned version, so they fall back to the latest version, which is today's behaviour. The session-state response may expose the pinned version if the OpenAPI file is updated to match.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** None (can start immediately; can run in parallel with 01)

**Status:** resolved

- [x] Handler test: a session created on v1 of a pack, after v2 of the same pack is registered, deals its round board from v1's cards
- [x] Handler test: a Posttest in that session is marked against v1's assessment instrument, not v2's
- [x] Handler test: the perception survey in that session uses v1's survey
- [x] Repository contract suite (in-memory + Mongo, curriculum pack): looking up by id and version returns that exact version, and an unknown version returns nothing
- [x] Game Session repository contract suite: the pinned Pack Version round-trips; Mongo-only case: a legacy session with no pinned version loads and uses the latest version
- [x] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse

**Resolution (2026-11-19):** `CreateGameSessionUseCase` pins `pack.version` (the latest at creation) on the Game Session as `packVersion`, stored in MongoDB (`game_sessions.packVersion`, absent/null on legacy sessions) and exposed as the optional `packVersion` on `PublicSessionState` in OpenAPI. A new application service, `SessionPackLoader`, reads the pinned version through the new `CurriculumPackRepositoryPort.findByIdAndVersion` (falling back to `findById`, the latest, when unpinned); the board deal, assessment and survey use cases use it. The pack repositories now keep every Pack Version: the in-memory repository keys by id and version, and the Mongo repository stores new versions under `_id = <packId>@<version>` with a `packId` field, while still reading older documents whose `_id` is the pack id (seeded System Packs). Before this, registering v2 overwrote v1 in memory and hit a duplicate `_id` in MongoDB. `findById` and the listings return the highest semver (`semver` package). Tests: `tests/functions/session-pack-version.test.ts`, `tests/adapters/curriculum-pack-repository.contract.test.ts`, and new cases in the Game Session contract suite and `mongo-game-session-repository.test.ts` (the Mongo-only legacy case lives there). Checks: typecheck clean, vitest 431 passed, BDD 5/5 features, lint 118, boundaries 6.
