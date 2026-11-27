# 5. Property-Based Tests (`tests/property/`)

Contains **Property-Based Tests** (using `fast-check`) that verify mathematical and domain invariants across hundreds of randomly generated inputs:
- `domain-invariants.property.test.ts` — `BoardDealer.deal` determinism & card uniqueness, Chebyshev-8 Concept Chain adjacency & reversal symmetry (`visitsSameCells(P, reverse(P))`), `LearnerAnalyticsService` & `CohortAnalyticsService` bounds (`chainDiversityIndex ∈ [0, 1]`, percentage sums, Neglect Heatmap bounds), and `MongoCredentialStripper`.

Run:
```bash
npx vitest run tests/property
```
