# 03: [PROPERTY-BASED TESTS] Domain & analytics mathematical invariant suite (`tests/property/domain-invariants.property.test.ts`)

**Category:** Property-Based Testing (`tests/property/`)

**What to build:** Install `fast-check` in `devDependencies` (per ADR-0005), create `tests/property/` (with `tests/property/README.md`), and build `tests/property/domain-invariants.property.test.ts` to verify core domain and analytics invariants across generated inputs:
1. **`BoardDealer.deal(pack, seed)` invariants:**
   - For any valid board dimensions `rows × cols` (`3..7`) and deck size `N >= rows * cols` and any arbitrary string `seed`, the dealt board always has `rows` rows and `cols` columns, every cell is a distinct `KeywordCard` from `pack.cards` (no duplicate card IDs on the board), and calling `deal(pack, seed)` twice with the same seed produces the exact same board grid.
2. **Chebyshev-8 Concept Chain topology & reversal symmetry invariants:**
   - For any generated valid adjacent path `P` of length `>= minChainLength` without duplicate cells, `reverse(P)` is also topologically valid and `GameSession` rejects `reverse(P)` from the same participant in the same round with `ChainAlreadySubmittedError` (`409 CHAIN_ALREADY_SUBMITTED`).
   - Any path containing a step where `max(|r1 - r2|, |c1 - c2|) > 1` or `(|r1 - r2| === 0 && |c1 - c2| === 0)` is rejected as invalid topology.
3. **Metacognitive analytics & Board Neglect Heatmap invariants (`LearnerAnalyticsService` & `CohortAnalyticsService`):**
   - For any generated Pretest and Posttest answer maps (`0 | 1 | 2 | 3 | "I_DONT_KNOW"`), `correctPercentage`, `guessingErrorPercentage`, and `uncertaintyCalibratedPercentage` are each in `[0, 100]` and sum to `100` (within floating-point tolerance).
   - `chainDiversityIndex` is always in `[0, 1]`, and every cell of `boardNeglectHeatmap[r][c]` is an integer in `[0, activeParticipantCount]`.
4. **`MongoCredentialStripper.strip` invariant:**
   - For any generated username and password embedded in `mongodb://user:pass@host/db` or `mongodb+srv://user:pass@host/db`, the stripped string never contains `user:pass@` and always replaces it with `<redacted>@`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `fast-check` is installed in root `devDependencies`
- [x] `tests/property/README.md` and `tests/property/domain-invariants.property.test.ts` exist and pass in Vitest
- [x] Covers `BoardDealer` determinism/uniqueness, Chebyshev-8 & reversal symmetry, analytics/heatmap bounds, and `MongoCredentialStripper`
