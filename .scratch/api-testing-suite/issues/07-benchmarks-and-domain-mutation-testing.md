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

**Status:** done

- [x] `tests/benchmarks/README.md` and `tests/benchmarks/domain-and-analytics.bench.ts` exist and `npm run bench` runs cleanly
- [x] `stryker.config.mjs` and `"test:mutation"` script are configured for `src/domain/**/*.ts`
- [x] Every folder listed in `tests/README.md` and `wiki/23-api-testing-taxonomy-and-folder-structure.md` (`domain/`, `adapters/`, `functions/`, `contracts/`, `property/`, `fuzz/`, `security/`, `chaos/`, `benchmarks/`, `web/`, `integration/`) exists and passes all checks
- [x] Full sequential verification: `npm run typecheck`, `npm run typecheck:web`, `npx vitest run --no-file-parallelism`, `npm run lint` (≤ 29), `npm run lint:web` (0), and `npm run lint:boundaries` (≤ 6)

## Resolution

- `tests/benchmarks/domain-and-analytics.bench.ts` + `npm run bench` (`vitest bench --run`): 7×7 `BoardDealer.deal` (~174k ops/s), 20 Chebyshev-8 chains validated and recorded via `GameSession.addChain` (~27k ops/s), 30-learner `CohortAnalyticsService.buildSummary` with pre/posttests and 2 chains each (~5k ops/s). `vitest run` only includes `*.test.ts`, so benches never run in the normal suite.
- `stryker.config.mjs` (vitest runner, `perTest` coverage, concurrency 1) mutates `src/domain/**/*.ts` (minus `*.types.ts`) against `stryker.vitest.config.ts`, which runs only `tests/domain` + `tests/property` (no MongoDB/HTTP). `npm run test:mutation` = `stryker run`. Output (`reports/`, `.stryker-tmp/`) is git-ignored. Validated with a dry run and a scoped run on `room-code.ts` (21 mutants, score 61.9%); no full mutation run was made.
- `tests/test-suite-layout.test.ts` guards the 11 documented `tests/` folders (exist, documented in `tests/README.md` and wiki 23, hold at least one check), the bench exclusion, the npm scripts and the Stryker config. The benchmark lines in `tests/README.md` and wiki 23 now describe the shipped benches (30 learners, no Argon2id).
- Verification (sequential): typecheck and typecheck:web clean, vitest 61 files / 1008 tests passed, lint 29, lint:web 0, lint:boundaries 6, bench clean.
