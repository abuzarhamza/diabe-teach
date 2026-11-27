# 9. Performance Micro-Benchmarks (`tests/benchmarks/`)

Contains **Benchmark Tests** (`vitest bench`) measuring CPU throughput and latency of hot domain and analytics paths:
- `domain-and-analytics.bench.ts` — 7×7 `BoardDealer.deal`, Chebyshev-8 Concept Chain validation, and 30-learner `CohortAnalyticsService.buildSummary` (Board Neglect Heatmap & Chain Diversity Index).

Run:
```bash
npm run bench
```
