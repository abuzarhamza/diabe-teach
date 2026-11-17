# 02: `POST /api/v1/packs/validate` - Validate Curriculum Pack

**What to build:** An endpoint that validates a Curriculum Pack structure without registering it. Performs schema validation (required fields, types), semantic validation (domain references, card references), and calibration validation (board dimensions match). Returns detailed errors and warnings for curriculum authors to fix issues.

**Blocked by:** 01-extend-pack-domain-model

**Status:** completed

- [x] Create `PackValidator` service in `src/application/services/` with validation logic
- [x] Schema validation: required fields, slug pattern for packId, array minimums
- [x] Semantic validation: card domainIds reference existing domains
- [x] Calibration validation: calibration board dimensions match boardConfig
- [x] Create `ValidateCurriculumPackUseCase` in `src/application/use-cases/`
- [x] Create port definition with `ValidationError` and `ValidationWarning` types
- [x] Create HTTP handler `netlify/functions/packs/validate-pack.ts`
- [x] Require instructor Capability Token
- [x] Return `{ valid: boolean, errors: [], warnings: [] }`
- [x] Tests: valid pack, invalid domain ref, missing required fields, warnings for optional fields
