# 07: [BENCHMARKS & MUTATION] Performance micro-benchmarks (`tests/benchmarks/`) and domain mutation testing config (`stryker.config.mjs`)

**Category:** Benchmark & Mutation Testing (`tests/benchmarks/` + `stryker.config.mjs`)

**What to build:** Create `tests/benchmarks/` (with `tests/benchmarks/README.md`), add a `vitest bench` suite for CPU-intensive domain/analytics operations, and configure domain mutation testing:
1. **Performance Micro-Benchmarks (`tests/benchmarks/domain-and-analytics.bench.ts` & `npm run bench`):**
   - Add `"bench": "vitest bench --run"` to root `package.json`.
   - Benchmark in `tests/benchmarks/domain-and-analytics.bench.ts`:
     - `BoardDealer.deal`: dealing a 7×7 (49-card) `DIABE_TEACH_PACK` board with a deterministic seed.
     - `GameSession` + `ConceptChain`: validating and recording 20 Chebyshev-8 Concept Chains on a 7×7 board.
     - `CohortAnalyticsService.buildSummary`: computing the 7×7 **Board Neglect Heatmap**, mean Pretest/Posttest scores, and **Chain Diversity Index** across a 30-learner classroom session.
2. **Domain Mutation Testing Configuration (`stryker.config.mjs` & `npm run test:mutation`):**
   - Install `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` in `devDependencies` (or configure `stryker.config.mjs` targeting `src/domain/**/*.ts` with `"test:mutation": "stryker run"` in `package.json`).
   - Add a Vitest check or run a scoped mutation check verifying the config is valid and all `tests/` folders match `wiki/23-api-testing-taxonomy-and-folder-structure.md` and `tests/README.md`.

**Blocked by:** 01, 02, 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] `tests/benchmarks/README.md` and `tests/benchmarks/domain-and-analytics.bench.ts` exist and `npm run bench` runs cleanly
- [ ] `stryker.config.mjs` and `"test:mutation"` script are configured for `src/domain/**/*.ts`
- [ ] Every folder listed in `tests/README.md` and `wiki/23-api-testing-taxonomy-and-folder-structure.md` (`domain/`, `adapters/`, `functions/`, `contracts/`, `property/`, `fuzz/`, `security/`, `chaos/`, `benchmarks/`, `web/`, `integration/`) exists and passes all checks
- [ ] Full sequential verification: `npm run typecheck`, `npm run typecheck:web`, `npx vitest run --no-file-parallelism`, `npm run lint` (≤ 29), `npm run lint:web` (0), and `npm run lint:boundaries` (≤ 6)
