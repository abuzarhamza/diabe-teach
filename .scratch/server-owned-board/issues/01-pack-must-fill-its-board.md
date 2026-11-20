# 01: A Curriculum Pack that can't fill its board is refused

**What to build:** A Curriculum Pack must have at least `rows × cols` Keyword Cards (from its `boardConfig`), so that a Game Session can always deal a full board. Validating such a pack reports a clear issue on the cards. Registering it is refused. Creating a Game Session with a pack that can't fill its board is refused too, which guards packs stored before the rule existed. The built-in `diabe-teach` pack (49 cards, 7×7) is unaffected.

See spec: `.scratch/server-owned-board/spec.md` (Implementation Decisions → Pack capacity).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler test: validating a pack with fewer cards than `rows × cols` returns `valid: false` with an issue naming the card shortfall
- [x] Handler test: registering such a pack is refused with the existing pack-validation error response
- [x] Handler test: creating a session with a stored pack that can't fill its board is refused with a clear error, and no session is stored
- [x] Handler test: a pack with exactly `rows × cols` cards, and one with more, validate and register as before
- [x] OpenAPI documents the new validation issue and the session-creation refusal
- [x] Existing tests, BDD and the lint baselines (132 lint errors, 6 boundary violations) are no worse
