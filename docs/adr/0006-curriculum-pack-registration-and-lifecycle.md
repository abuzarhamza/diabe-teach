# ADR-0006: Curriculum Pack Registration and Lifecycle

## Status

Accepted

## Context

The platform needs to support curriculum authors registering custom Curriculum Packs beyond the built-in Diabe-teach pack. This requires decisions about:

- Who can register packs (authorization)
- Whether packs can be modified after registration (mutability)
- How to handle pack versions and updates
- How to remove packs from circulation without breaking existing sessions
- How to protect system-provided packs

These decisions affect data integrity for research studies, user experience for curriculum authors, and system complexity.

## Decision

### 1. Authorization

Only users holding an **instructor** Capability Token can register new Curriculum Packs. This aligns with the existing security model where instructors have elevated privileges and prevents anonymous pack pollution.

> **Updated by ADR-0007:** pack routes take an **Account Token** (a signed-in Instructor Account) instead of an instructor Capability Token, and any signed-in teacher may release a new version of, archive, or unarchive any non-system pack.

### 2. Immutability

Registered Curriculum Packs are **completely immutable**. To "edit" a pack, authors must register a new version with an incremented `version` field. This preserves research integrity when comparing pre/post results across sessions that used the same pack version.

### 3. Versioning

The same `packId` can have multiple versions. The `version` field (semantic version string) distinguishes them:
- `GET /api/v1/packs/{packId}` returns the latest version
- `GET /api/v1/packs/{packId}/versions/{version}` returns a specific version
- Registering a duplicate `packId` + `version` returns `409 Conflict`

### 4. Pack Archive (Soft-Delete)

Packs cannot be deleted. Instead, they can be **archived** via `POST /api/v1/packs/{packId}/archive`:
- Archived packs are hidden from `GET /api/v1/packs` listing
- Archived packs remain accessible via direct `GET /api/v1/packs/{packId}`
- Existing Game Sessions continue to function with their referenced pack

### 5. System Packs

Built-in packs (e.g., `diabe-teach`) are seeded to MongoDB with `isSystemPack: true`:
- Cannot be archived or modified
- Appear in listings alongside user-registered packs
- Unified query path for all packs

### 6. Validation

`POST /api/v1/packs/validate` performs three levels of validation:
- **Schema**: Required fields, correct types
- **Semantic**: All card `domainId` references exist in domains array
- **Calibration**: Calibration examples match stated board layout

Returns `{ valid: boolean, errors: [], warnings: [] }` for actionable feedback.

### 7. Ownership

Packs track `createdBy` and an optional `authorName` metadata field for human-readable attribution.

> **Updated by ADR-0007:** `createdBy` is the **Instructor Account id** of whoever released that Pack Version (each version records its own author), and archiving records the acting account and the time. The author handle shown in Game setup is the part of that account's email before the @. Packs registered before this change keep the instructor's sessionId in `createdBy` and show no author handle.

### 8. Minimum Pack Structure

A valid pack requires: `packId`, `title`, `version`, `description`, `boardConfig`, `domains` (≥1), `cards` (≥1), and `adjudicationRubric`. The `assessmentInstrument` and `perceptionSurvey` remain optional.

## Consequences

### Positive

- **Research integrity**: Immutable packs ensure consistent conditions across study sessions
- **Safe iteration**: Authors can publish new versions without breaking existing sessions
- **Clean removal**: Archiving hides packs without orphaning session data
- **Unified model**: System and user packs share the same storage and query patterns

### Negative

- **Storage growth**: Every version is a full document copy (no delta storage)
- **No true deletion**: Archived packs remain in database forever
- **Version discovery**: Users need a way to list/compare versions of a pack

### Neutral

- Pack registration requires instructor auth, which may require sessions to be created first for custom pack workflows
