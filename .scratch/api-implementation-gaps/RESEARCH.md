# API Implementation Gaps Research Report

**Date:** 2026-11-16
**Branch:** feat/netlify-v2-local-dev-compatibility
**OpenAPI Spec:** `/Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/docs/api/openapi.yaml`

---

## Executive Summary

The diabe-teach project has a well-defined OpenAPI 3.1.0 specification with **15 endpoints** across four functional areas. Currently, **11 endpoints are implemented** with corresponding Netlify functions and use cases, while **4 endpoints remain unimplemented** (all in the Assessments & Analytics category). Additionally, there is **no SSE streaming implementation** for real-time session events.

---

## 1. Summary of Implemented Endpoints

### Packs Domain (6/4 in OpenAPI - 2 extra beyond spec)

| Endpoint | Method | OpenAPI | Netlify Function | Use Case | Status |
|----------|--------|---------|------------------|----------|--------|
| `/api/v1/packs` | GET | Yes | `list-packs.ts` | `ListCurriculumPacksUseCase` | IMPLEMENTED |
| `/api/v1/packs` | POST | Yes | `register-pack.ts` | `RegisterCurriculumPackUseCase` | IMPLEMENTED |
| `/api/v1/packs/validate` | POST | Yes | `validate-pack.ts` | `ValidateCurriculumPackUseCase` | IMPLEMENTED |
| `/api/v1/packs/{packId}` | GET | Yes | `get-pack-by-id.ts` | `GetCurriculumPackByIdUseCase` | IMPLEMENTED |
| `/api/v1/packs/{packId}/archive` | POST | No* | `archive-pack.ts` | `ArchiveCurriculumPackUseCase` | IMPLEMENTED (extra) |
| `/api/v1/packs/{packId}/unarchive` | POST | No* | `unarchive-pack.ts` | `UnarchiveCurriculumPackUseCase` | IMPLEMENTED (extra) |

*Note: Archive/unarchive endpoints are implemented but NOT defined in the OpenAPI spec. Consider adding them to the spec for completeness.

### Sessions Domain (7/7 in OpenAPI)

| Endpoint | Method | OpenAPI | Netlify Function | Use Case | Status |
|----------|--------|---------|------------------|----------|--------|
| `/api/v1/sessions` | POST | Yes | `create-session.ts` | `CreateGameSessionUseCase` | IMPLEMENTED |
| `/api/v1/sessions/join` | POST | Yes | `join-session.ts` | `JoinGameSessionUseCase` | IMPLEMENTED |
| `/api/v1/sessions/{sessionId}` | GET | Yes | `get-session.ts` | `GetGameSessionStateUseCase` | IMPLEMENTED |
| `/api/v1/sessions/{sessionId}/stream` | GET | Yes | N/A | N/A | **NOT IMPLEMENTED** |
| `/api/v1/sessions/{sessionId}/phase` | POST | Yes | `transition-phase.ts` | `TransitionSessionPhaseUseCase` | IMPLEMENTED |

### Chains Domain (3/3 in OpenAPI)

| Endpoint | Method | OpenAPI | Netlify Function | Use Case | Status |
|----------|--------|---------|------------------|----------|--------|
| `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains` | POST | Yes | `submit-chain.ts` | `SubmitConceptChainUseCase` | IMPLEMENTED |
| `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/{chainId}/adjudicate` | POST | Yes | `adjudicate-chain.ts` | `AdjudicateConceptChainUseCase` | IMPLEMENTED |
| `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/standings` | GET | Yes | `get-standings.ts` | `GetRoundStandingsUseCase` | IMPLEMENTED |

### Assessments & Analytics Domain (0/4 in OpenAPI)

| Endpoint | Method | OpenAPI | Netlify Function | Use Case | Status |
|----------|--------|---------|------------------|----------|--------|
| `/api/v1/sessions/{sessionId}/assessments/{stage}` | POST | Yes | N/A | N/A | **NOT IMPLEMENTED** |
| `/api/v1/sessions/{sessionId}/survey` | POST | Yes | N/A | N/A | **NOT IMPLEMENTED** |
| `/api/v1/sessions/{sessionId}/analytics` | GET | Yes | N/A | N/A | **NOT IMPLEMENTED** |

---

## 2. Missing Endpoints (Defined in OpenAPI but NOT Implemented)

### 2.1 SSE Stream Endpoint

**Path:** `GET /api/v1/sessions/{sessionId}/stream`
**OperationId:** `streamGameSessionEvents`
**Purpose:** Subscribe to real-time Server-Sent Events (SSE) for a Game Session

**Required Events (from OpenAPI schema `SseEventEnvelope`):**
- `session.snapshot`
- `participant.joined`
- `phase.changed`
- `chain.submitted`
- `chain.adjudicated`
- `standings.updated`

**Implementation Notes:**
- Netlify Functions have limited SSE support; may need edge functions or alternative architecture
- Consider using Netlify Edge Functions for long-lived connections
- Alternative: polling with `/api/v1/sessions/{sessionId}` + websocket gateway

---

### 2.2 Submit Assessment Attempt

**Path:** `POST /api/v1/sessions/{sessionId}/assessments/{stage}`
**OperationId:** `submitAssessmentAttempt`
**Purpose:** Submit a one-shot Pretest or Posttest Assessment Attempt

**Required Components:**
- **Port:** `submit-assessment-attempt.port.ts` (does not exist)
- **Use Case:** `SubmitAssessmentAttemptUseCase` (does not exist)
- **Netlify Function:** `submit-assessment.ts` (does not exist)
- **Domain Model:** Assessment attempt storage in `GameSession` (does not exist)

**Request Schema (`SubmitAssessmentRequest`):**
```typescript
{
  answers: Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW">
}
```

**Response Schemas:**
- `PretestSubmissionReceipt` (for stage=pretest): ungraded receipt
- `PosttestSubmissionResult` (for stage=posttest): full `LearnerMetacognitiveReport` + answer key review

**Error Codes to Handle:**
- `ASSESSMENT_ALREADY_SUBMITTED` (409)
- `ASSESSMENT_INCOMPLETE` (422)

---

### 2.3 Submit Perception Survey

**Path:** `POST /api/v1/sessions/{sessionId}/survey`
**OperationId:** `submitPerceptionSurvey`
**Purpose:** Submit 5-point Likert perception survey ratings

**Required Components:**
- **Port:** `submit-perception-survey.port.ts` (does not exist)
- **Use Case:** `SubmitPerceptionSurveyUseCase` (does not exist)
- **Netlify Function:** `submit-survey.ts` (does not exist)
- **Domain Model:** Survey response storage in `GameSession` (does not exist)

**Request Schema (`SubmitSurveyRequest`):**
```typescript
{
  responses: Record<string, 1 | 2 | 3 | 4 | 5>,
  comments?: string
}
```

**Response Schema:**
```typescript
{
  participantId: string,
  recordedItemCount: number,
  submittedAt: string // ISO date-time
}
```

---

### 2.4 Get Session Analytics

**Path:** `GET /api/v1/sessions/{sessionId}/analytics`
**OperationId:** `getSessionAnalytics`
**Purpose:** Fetch individual learner or full cohort metacognitive and gameplay analytics

**Required Components:**
- **Port:** `get-session-analytics.port.ts` (does not exist)
- **Use Case:** `GetSessionAnalyticsUseCase` (does not exist)
- **Netlify Function:** `get-analytics.ts` (does not exist)
- **Domain Model:** Analytics aggregation logic (does not exist)

**Response Schema (`SessionAnalyticsResponse`):**
```typescript
{
  role: "participant" | "instructor",
  participantReport?: LearnerMetacognitiveReport | null,
  cohortSummary: CohortAnalyticsReport
}
```

**Key Metrics to Compute:**
- `chainDiversityIndex` (0-1)
- `neglectedKeywordIds`
- `pretestCohortMeanPercentage`
- `posttestCohortMeanPercentage`
- `boardNeglectHeatmap` (2D matrix)

---

## 3. Unimplemented Use Cases Analysis

### Current Use Cases (13 total):
1. `AdjudicateConceptChainUseCase`
2. `ArchiveCurriculumPackUseCase`
3. `CreateGameSessionUseCase`
4. `GetCurriculumPackByIdUseCase`
5. `GetGameSessionStateUseCase`
6. `GetRoundStandingsUseCase`
7. `JoinGameSessionUseCase`
8. `ListCurriculumPacksUseCase`
9. `RegisterCurriculumPackUseCase`
10. `SubmitConceptChainUseCase`
11. `TransitionSessionPhaseUseCase`
12. `UnarchiveCurriculumPackUseCase`
13. `ValidateCurriculumPackUseCase`

### Missing Use Cases (4 required):
1. **`SubmitAssessmentAttemptUseCase`** - Handle pretest/posttest submissions
2. **`SubmitPerceptionSurveyUseCase`** - Record Likert survey responses
3. **`GetSessionAnalyticsUseCase`** - Compute and return analytics
4. **(Optional) `StreamSessionEventsUseCase`** - If implementing SSE

---

## 4. Specific Code Locations That Need Work

### 4.1 Domain Layer Extensions

**File:** `/Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/domain/game-session/game-session.ts`

Missing domain concepts:
- `AssessmentAttempt` entity
- `SurveyResponse` entity
- Methods: `submitAssessment()`, `submitSurvey()`, `getAnalytics()`

**New Files Needed:**
```
src/domain/game-session/assessment-attempt.ts
src/domain/game-session/survey-response.ts
src/domain/game-session/analytics.ts
```

### 4.2 Application Layer Extensions

**New Ports Needed:**
```
src/application/ports/submit-assessment-attempt.port.ts
src/application/ports/submit-perception-survey.port.ts
src/application/ports/get-session-analytics.port.ts
```

**New Use Cases Needed:**
```
src/application/use-cases/submit-assessment-attempt.use-case.ts
src/application/use-cases/submit-perception-survey.use-case.ts
src/application/use-cases/get-session-analytics.use-case.ts
```

### 4.3 HTTP Layer (Netlify Functions)

**New Functions Needed:**
```
netlify/functions/sessions/submit-assessment.ts
netlify/functions/sessions/submit-survey.ts
netlify/functions/sessions/get-analytics.ts
netlify/functions/sessions/stream-events.ts (if SSE)
```

**Root-level Delegators:**
```
netlify/functions/submit-assessment.ts
netlify/functions/submit-survey.ts
netlify/functions/get-analytics.ts
netlify/functions/stream-events.ts (if SSE)
```

### 4.4 netlify.toml Updates Needed

Add these redirects:
```toml
[[redirects]]
  from = "/api/v1/sessions/:sessionId/assessments/:stage"
  to = "/.netlify/functions/submit-assessment"
  status = 200
  force = true

[[redirects]]
  from = "/api/v1/sessions/:sessionId/survey"
  to = "/.netlify/functions/submit-survey"
  status = 200
  force = true

[[redirects]]
  from = "/api/v1/sessions/:sessionId/analytics"
  to = "/.netlify/functions/get-analytics"
  status = 200
  force = true

[[redirects]]
  from = "/api/v1/sessions/:sessionId/stream"
  to = "/.netlify/functions/stream-events"
  status = 200
  force = true
```

### 4.5 Domain Errors to Add

**File:** `/Users/abuzarhamza/Desktop/workspaceGithub/diabe-teach/src/domain/errors/domain-errors.ts`

```typescript
export class AssessmentAlreadySubmittedError extends DomainError {
  public readonly code = "ASSESSMENT_ALREADY_SUBMITTED" as const;
  // ...
}

export class AssessmentIncompleteError extends DomainError {
  public readonly code = "ASSESSMENT_INCOMPLETE" as const;
  // ...
}
```

---

## 5. Recommended Priority Order for Remaining Work

### Priority 1: Assessment Submission (Critical for Core Gameplay)

**Why:** Pretest and posttest assessments are fundamental to the educational game flow. The phase transitions already include `pretest` and `posttest` phases but no way to submit answers.

**Effort:** Medium (3-5 days)

**Tasks:**
1. Create `AssessmentAttempt` domain entity
2. Extend `GameSession` with assessment storage
3. Create `SubmitAssessmentAttemptUseCase`
4. Create Netlify function and routing
5. Add error handling for duplicate submissions

---

### Priority 2: Perception Survey (Required for Complete Session)

**Why:** The `feedback-survey` phase exists but has no endpoint to submit survey responses. This blocks session completion flow.

**Effort:** Low (1-2 days)

**Tasks:**
1. Create `SurveyResponse` domain entity
2. Extend `GameSession` with survey storage
3. Create `SubmitPerceptionSurveyUseCase`
4. Create Netlify function and routing

---

### Priority 3: Session Analytics (Instructor & Learner Value)

**Why:** Analytics provide metacognitive feedback to learners and cohort insights to instructors. This is a key differentiator for educational effectiveness.

**Effort:** Medium-High (3-5 days)

**Tasks:**
1. Create analytics computation logic (chain diversity, neglect heatmap, etc.)
2. Create `GetSessionAnalyticsUseCase` with role-based response
3. Create Netlify function and routing
4. Handle participant vs instructor view logic

---

### Priority 4: SSE Streaming (Nice-to-Have for Real-time UX)

**Why:** Real-time updates enhance classroom experience but the API can function with polling as fallback.

**Effort:** High (5-7 days)

**Tasks:**
1. Research Netlify Edge Functions for SSE support
2. Implement event publishing from use cases
3. Create SSE endpoint with proper connection management
4. Handle reconnection and event replay

---

## 6. OpenAPI Spec Inconsistencies

### Missing from OpenAPI but Implemented:
- `POST /api/v1/packs/{packId}/archive` - Archive curriculum pack
- `POST /api/v1/packs/{packId}/unarchive` - Unarchive curriculum pack

### Recommendation:
Add these operations to the OpenAPI spec under the `Packs` tag to maintain contract accuracy.

---

## 7. Additional Observations

### No TODO/FIXME Comments
The codebase has no TODO or FIXME comments indicating incomplete work - the missing features simply don't exist yet.

### Well-Structured Architecture
The existing implementation follows clean architecture patterns:
- Domain layer is independent
- Use cases are well-isolated
- Ports define clear interfaces
- Netlify functions are thin HTTP adapters

### Testing Gap
The git status shows BDD tests were added but some test files were deleted. Integration tests for new endpoints will be needed.

---

## Appendix: File Structure Summary

```
netlify/functions/
  packs/
    archive-pack.ts      [IMPLEMENTED]
    get-pack-by-id.ts    [IMPLEMENTED]
    list-packs.ts        [IMPLEMENTED]
    register-pack.ts     [IMPLEMENTED]
    unarchive-pack.ts    [IMPLEMENTED]
    validate-pack.ts     [IMPLEMENTED]
  sessions/
    adjudicate-chain.ts  [IMPLEMENTED]
    create-session.ts    [IMPLEMENTED]
    get-session.ts       [IMPLEMENTED]
    get-standings.ts     [IMPLEMENTED]
    join-session.ts      [IMPLEMENTED]
    submit-chain.ts      [IMPLEMENTED]
    transition-phase.ts  [IMPLEMENTED]
    submit-assessment.ts [MISSING]
    submit-survey.ts     [MISSING]
    get-analytics.ts     [MISSING]
    stream-events.ts     [MISSING]
```
