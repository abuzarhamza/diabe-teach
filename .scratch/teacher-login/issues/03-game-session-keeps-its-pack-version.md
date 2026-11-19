# 03: A running Game Session keeps the Pack Version it started with

**What to build:** When a Game Session is created, it records the **Pack Version** of its Curriculum Pack (the latest version at that moment). Everything that reads the pack for that session uses the pinned version, even if someone registers a newer one while the class is running: the board deal, Pretest and Posttest Assessment Attempts, and the perception survey. The curriculum pack repository gains a lookup by pack id **and** version. The existing latest-version lookup stays for Game setup and direct pack reads.

The version is persisted in MongoDB. Game Sessions stored before this change have no pinned version, so they fall back to the latest version, which is today's behaviour. The session-state response may expose the pinned version if the OpenAPI file is updated to match.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** None (can start immediately; can run in parallel with 01)

**Status:** ready-for-agent

- [ ] Handler test: a session created on v1 of a pack, after v2 of the same pack is registered, deals its round board from v1's cards
- [ ] Handler test: a Posttest in that session is marked against v1's assessment instrument, not v2's
- [ ] Handler test: the perception survey in that session uses v1's survey
- [ ] Repository contract suite (in-memory + Mongo, curriculum pack): looking up by id and version returns that exact version, and an unknown version returns nothing
- [ ] Game Session repository contract suite: the pinned Pack Version round-trips; Mongo-only case: a legacy session with no pinned version loads and uses the latest version
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
