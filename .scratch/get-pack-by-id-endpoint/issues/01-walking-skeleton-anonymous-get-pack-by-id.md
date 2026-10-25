# 01: Walking Skeleton — Anonymous `GET /api/v1/packs/{packId}` with Built-in `diabe-teach` Curriculum Pack & `404 PACK_NOT_FOUND`

**What to build:** Bootstrap the TypeScript, Vitest, and `dependency-cruiser` workspace and deliver the first end-to-end vertical slice across the Hexagonal DDD rings (`Domain`, `Application`, `HTTP Driving Adapter`, and `InMemoryCurriculumPackRepository` Driven Adapter). Anonymous callers can fetch `GET /api/v1/packs/diabe-teach` (`200 OK`) and receive all 49 verbatim Appendix 1 `KeywordCard`s (with aliases), 7 `SemanticDomain`s, `boardConfig` (`7×7`, `minChainLength: 4`, `"chebyshev-8"`), and Figure 2 `CalibrationExample`s (Valid Chain A [9 cards], Valid Chain B [7 cards], and Invalid Chain C [4 cards, `isValid: false`]), while unknown pack IDs return `404 Not Found` (`PACK_NOT_FOUND`).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `GET /api/v1/packs/diabe-teach` returns `200 OK` (`Content-Type: application/json`) with `{ pack }` containing all 49 Appendix 1 `KeywordCard`s (with `id`, `verbatimLabel`, `displayLabel`, `aliases`, `domainId`, and `summary`), 7 `SemanticDomain`s, `boardConfig` (`rows: 7`, `cols: 7`, `minChainLength: 4`, `adjacencyRule: "chebyshev-8"`), and the `adjudicationRubric` with Figure 2's 7×7 `calibrationBoardCardIds` and three `calibrationExamples` (Chains A, B, and C).
- [x] `CurriculumPack` Aggregate Root and `PackId` Value Object live in the pure Domain Ring (`src/domain/`) with $O(1)$ lookup by card ID, verbatim label, display label, and alias (`"Hyperglycemia"` $\to$ `"hyperglycaemia"`, `"lipodistrophy"` $\to$ `"lipo-hypertrophy"`).
- [x] `GET /api/v1/packs/unknown-pack` returns `404 Not Found` with `{ code: "PACK_NOT_FOUND", message: "Curriculum Pack 'unknown-pack' was not found.", details: { packId: "unknown-pack" } }` conforming to the OpenAPI 3.1 `ApiErrorResponse` schema.
- [x] `npm run lint:boundaries` (`dependency-cruiser`) passes with zero architectural boundary violations across `src/domain/`, `src/application/`, and `src/adapters/`.
- [x] `npm test` and `npm run typecheck` pass via TDD red-green cycles at the `createApp(deps).fetch(request)` and Domain Aggregate seams.
