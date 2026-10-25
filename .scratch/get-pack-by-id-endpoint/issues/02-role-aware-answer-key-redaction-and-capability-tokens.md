# 02: Role-Aware Assessment Answer-Key Redaction & `CapabilityToken` Verification (`200` Redacted vs. Full Key & `401 UNAUTHORIZED_TOKEN`)

**What to build:** Extend `DIABE_TEACH_PACK` with the 10 Bloom Level 2/3 multiple-choice questions and 9 Appendix 2 Likert perception survey items, and wire `CapabilityTokenPort` (`HmacCapabilityTokenAdapter` + `FakeCapabilityTokenAdapter`) and `CurriculumPackProjector` through `GET /api/v1/packs/{packId}` so answer keys (`correctIndex` and `explanation`) are redacted for anonymous and `participantToken` callers, preserved for verified `instructorToken` callers without mutating the cached `CurriculumPack` Aggregate Root, and rejected with `401 UNAUTHORIZED_TOKEN` when an `Authorization` header is malformed or invalid.

**Blocked by:** 01: Walking Skeleton — Anonymous `GET /api/v1/packs/{packId}` with Built-in `diabe-teach` Curriculum Pack & `404 PACK_NOT_FOUND`

**Status:** resolved

- [x] `DIABE_TEACH_PACK` includes the 10 Bloom Level 2/3 `AssessmentQuestion` items and the 9 verbatim Appendix 2 `PerceptionSurveyItem` prompts.
- [x] `GET /api/v1/packs/diabe-teach` with no `Authorization` header returns `200 OK` with 10 assessment questions where `correctIndex` and `explanation` are omitted (`undefined`), plus all 9 perception survey items.
- [x] `GET /api/v1/packs/diabe-teach` with a valid `Authorization: Bearer <participantToken>` returns `200 OK` with `correctIndex` and `explanation` omitted.
- [x] `GET /api/v1/packs/diabe-teach` with a valid `Authorization: Bearer <instructorToken>` returns `200 OK` with `correctIndex` (`0..3`) and `explanation` included on all 10 assessment questions.
- [x] Redacting fields for an anonymous/participant request never mutates the underlying `DIABE_TEACH_PACK` Aggregate Root for subsequent instructor requests (and vice versa).
- [x] `GET /api/v1/packs/diabe-teach` with a malformed `Authorization` header (e.g., `Basic abc`, empty `Bearer `, or an invalid/tampered token signature) returns `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "..." }`.
- [x] `HmacCapabilityTokenAdapter` signs and verifies stateless capability tokens (`role: "instructor" | "participant"`, `sessionId`, `participantId?`) using HMAC-SHA256, and `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass.
