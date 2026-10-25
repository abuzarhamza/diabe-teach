# 09 - Engineering Decisions & Environment Log

Historical record of architectural decisions, environment improvements ("pit of success"), and vertical-slice milestones recorded by the Chief of Staff workflow.

---

## 2026-10-24 — Repo Setup, Domain Model & OpenAPI 3.1 Contract

- **On 2026-10-24**, the repository was configured via `setup-matt-pocock-skills` (`AGENTS.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`) to track specs and tickets as local markdown files under `.scratch/<feature-slug>/` using the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) and a single-context domain layout (`GLOSSARY.md` and `docs/adr/`).
- **On 2026-10-24**, [`ADR-0001`](../docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md) was recorded: the Concept-Chain Educational Game Engine was designed to be subject-agnostic so educators can author custom **Curriculum Packs** (`CurriculumPack`) with configurable board dimensions and adjudication rubrics, while shipping `diabe-teach` (49 Appendix 1 keywords, 7 Semantic Domains, Figure 2 Calibration Examples, 10 Bloom Level 2/3 MCQs, and 9 Appendix 2 Likert items) as the built-in pack.
- **On 2026-10-24**, [`ADR-0002`](../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md) and [`docs/agents/api-architecture.md`](../docs/agents/api-architecture.md) established the four-ring **Hexagonal DDD** architecture (`src/domain/`, `src/application/`, `src/adapters/driving/`, `src/adapters/driven/`), the **Netlify Functions v2** catch-all Composition Root (`netlify/functions/api.ts`), and **MongoDB** persistence (`MongoCurriculumPackRepository`, `MongoSessionRepository`).
- **On 2026-10-24**, the OpenAPI 3.1.0 contract was authored at [`docs/api/openapi.yaml`](../docs/api/openapi.yaml) alongside [`.scratch/openapi-contract/spec.md`](../.scratch/openapi-contract/spec.md).

---

## 2026-10-24 — Pit of Success Environment & `GET /api/v1/packs/{packId}` Vertical Slice

- **On 2026-10-24**, the TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), Vitest (`vitest.config.ts`), and `dependency-cruiser` (`.dependency-cruiser.cjs`) environment was created to enforce inward-only Hexagonal DDD ring dependencies and isolate `mongodb` imports strictly to `src/adapters/driven/` and `netlify/functions/`.
- **On 2026-10-24**, the specification [`.scratch/get-pack-by-id-endpoint/spec.md`](../.scratch/get-pack-by-id-endpoint/spec.md) was broken into three tracer-bullet tickets and implemented via TDD red-green loops:
  1. [Ticket 01](../.scratch/get-pack-by-id-endpoint/issues/01-walking-skeleton-anonymous-get-pack-by-id.md): Delivered `PackId`, `CurriculumPack`, `DIABE_TEACH_PACK` (49 Appendix 1 keywords, 7 Semantic Domains, Figure 2 Calibration Examples A/B/C), `GetCurriculumPackByIdUseCase`, `InMemoryCurriculumPackRepository`, and `createApp(deps)` serving `200 OK` and `404 PACK_NOT_FOUND`.
  2. [Ticket 02](../.scratch/get-pack-by-id-endpoint/issues/02-role-aware-answer-key-redaction-and-capability-tokens.md): Added the 10 Bloom Level 2/3 MCQs and 9 Appendix 2 Likert items to `DIABE_TEACH_PACK`, implemented `CapabilityTokenPort` (`HmacCapabilityTokenAdapter` and `FakeCapabilityTokenAdapter`), enforced role-aware answer-key redaction (`correctIndex` and `explanation` omitted for `"anonymous"` and `"participant"`, included for `"instructor"`), and returned `401 UNAUTHORIZED_TOKEN` on malformed/invalid `Authorization` headers.
  3. [Ticket 03](../.scratch/get-pack-by-id-endpoint/issues/03-hybrid-mongodb-persistence-and-netlify-composition-root.md): Implemented `MongoCurriculumPackRepository` ($O(1)$ in-memory fast path for `diabe-teach`, MongoDB `curriculum_packs` fallback for custom packs), `getMongoDatabase` warm-cached singleton, and `netlify/functions/api.ts` catch-all handler for `/api/v1/*`.
