# Spec: Curriculum Pack Registration and Lifecycle Endpoints

Status: ready-for-agent

## Problem Statement

Curriculum authors need to register custom Curriculum Packs, validate pack structure before registration, and manage pack lifecycle (archiving outdated packs). Currently only the built-in `diabe-teach` pack exists, and there's no way to add or manage custom packs.

## Solution

Implement four endpoints for pack management following the established hexagonal architecture pattern:

1. `POST /api/v1/packs` - Register a new Curriculum Pack
2. `POST /api/v1/packs/validate` - Validate pack structure without registering
3. `POST /api/v1/packs/{packId}/archive` - Archive a pack (soft-delete)
4. `POST /api/v1/packs/{packId}/unarchive` - Restore an archived pack

## User Stories

1. As a medical educator, I want to register a custom Curriculum Pack for my specialty (e.g., cardiology), so that my students can play concept-chaining games beyond diabetes.
2. As a curriculum author, I want to validate my pack structure before registration, so that I can fix errors without creating invalid entries.
3. As a curriculum author, I want to see specific error messages when validation fails, so that I know exactly what to fix.
4. As a curriculum author, I want to archive an outdated pack, so that new sessions don't use it while existing sessions continue working.
5. As a curriculum author, I want to restore an accidentally archived pack, so that it appears in the pack list again.
6. As a curriculum author, I want to register a new version of an existing pack, so that I can improve content while preserving the original for running studies.
7. As a platform operator, I want system packs (diabe-teach) protected from modification, so that the reference implementation remains stable.
8. As a researcher, I want to access any pack version by specifying packId + version, so that I can analyze data from historical studies.

## Implementation Decisions

### Authorization

- `POST /api/v1/packs` requires instructor Capability Token
- `POST /api/v1/packs/validate` requires instructor Capability Token
- `POST /api/v1/packs/{packId}/archive` requires instructor Capability Token
- `POST /api/v1/packs/{packId}/unarchive` requires instructor Capability Token

### Domain Model Changes

Add to `CurriculumPackProps`:
```typescript
readonly isSystemPack?: boolean;
readonly isArchived?: boolean;
readonly createdBy?: string;       // sessionId of registering instructor
readonly authorName?: string;      // optional human-readable author
readonly createdAt?: Date;
readonly archivedAt?: Date | null;
```

### Repository Port Extension

```typescript
interface CurriculumPackRepositoryPort {
  findById: (packId: PackId) => Promise<CurriculumPack | null>;
  findAll: () => Promise<readonly CurriculumPack[]>;
  findAllActive: () => Promise<readonly CurriculumPack[]>;  // excludes archived
  create: (pack: CurriculumPack) => Promise<void>;
  archive: (packId: PackId) => Promise<void>;
  unarchive: (packId: PackId) => Promise<void>;
  existsByIdAndVersion: (packId: PackId, version: string) => Promise<boolean>;
}
```

### Validation Rules

Schema validation:
- `packId` matches slug pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- `title`, `version`, `description` are non-empty strings
- `boardConfig` has valid rows, cols, minChainLength, adjacencyRule
- `domains` array has at least 1 entry
- `cards` array has at least 1 entry
- `adjudicationRubric` has evaluatorPersona, subjectDomain, chainContinuityCriteria

Semantic validation:
- Every card's `domainId` references an existing domain
- All calibration example `keywordIds` reference existing cards
- Calibration board dimensions match `boardConfig`

### Error Codes

- `PACK_ALREADY_EXISTS` (409) - packId + version combination exists
- `PACK_VALIDATION_FAILED` (422) - validation errors in request body
- `PACK_IS_SYSTEM_PACK` (403) - cannot archive/modify system packs
- `PACK_ALREADY_ARCHIVED` (409) - pack is already archived
- `PACK_NOT_ARCHIVED` (409) - pack is not archived (for unarchive)

### Response Formats

Register success (201):
```json
{
  "pack": { "id": "cardio-teach", "title": "...", "version": "1.0.0", ... }
}
```

Validation response (200):
```json
{
  "valid": false,
  "errors": [
    { "path": "cards[5].domainId", "message": "Domain 'invalid-domain' not found" }
  ],
  "warnings": [
    { "path": "assessmentInstrument", "message": "No assessment instrument provided" }
  ]
}
```

## Testing Decisions

### Testing Seam

Tests execute at the HTTP handler level using factory functions with injected dependencies.

### Test Cases

Register pack:
- Happy path: valid pack registered, returns 201
- Missing instructor token: returns 401
- Invalid pack structure: returns 422
- Duplicate packId + version: returns 409

Validate pack:
- Valid pack: returns `{ valid: true, errors: [], warnings: [] }`
- Invalid domain reference: returns validation error
- Missing optional fields: returns warnings

Archive pack:
- Happy path: pack archived, returns 200
- System pack: returns 403
- Already archived: returns 409
- Non-existent pack: returns 404

## Out of Scope

- Pack transfer (changing ownership)
- Pack collaboration (multiple authors)
- Version comparison/diff endpoints
- Bulk pack operations

## Further Notes

- See ADR-0006 for design rationale
- Glossary updated with: System Pack, Pack Version, Pack Archive
