# Spec: OpenAPI 3.1 Contract & Endpoint Specification for the Concept-Chain Game Platform

Status: ready-for-agent

## Problem Statement

While the high-level architecture for the subject-agnostic Concept-Chain Educational Game Engine and its inaugural *Diabe-teach* Curriculum Pack is defined, frontend client engineers, backend API implementers, and automated contract tests need a single, authoritative, machine-readable **OpenAPI 3.1 YAML specification** that pins down every HTTP status code, request/response payload schema, machine-readable error code, role-based bearer token rule, Server-Sent Events (SSE) payload shape, and domain invariant across all 14 endpoints.

Without a strict OpenAPI 3.1 contract:
- Clients cannot reliably distinguish between topological chain errors (such as a broken adjacency transition at step $i$) and phase-timing errors (such as submitting a Concept Chain after the 20-minute `chain-mapping` window has closed).
- Solo-mode learners would be forced to make redundant room-join round-trips before playing.
- Pretest assessment payloads or public Curriculum Pack fetches could accidentally leak `correctIndex` answer keys before the learner completes the Posttest.
- Peer votes or automated AI evaluations could accidentally overwrite an **Instructor Final Ruling**.
- Incomplete assessment submissions (skipping questions instead of explicitly choosing *"I don't know"*) or duplicate retries could corrupt study-grade **Uncertainty Calibration** metrics.

## Solution

Author a complete **OpenAPI 3.1.0 YAML contract** and corresponding contract validation suite covering all 4 resource groups (`/api/v1/packs`, `/api/v1/sessions`, `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains`, and `/api/v1/sessions/{sessionId}/assessments`, `/survey`, `/analytics`) with:
1. A standardized machine-readable error envelope (`ApiErrorResponse`) with 15 canonical error codes.
2. Session-scoped HTTP Bearer authentication (`BearerAuth`) distinguishing `instructorToken` and `participantToken` capabilities while keeping pack browsing and room joining frictionless.
3. Role-aware schema projection on Curriculum Pack and Assessment endpoints so answer keys (`correctIndex` and `explanation`) remain hidden from learners until Posttest completion.
4. Solo-mode auto-join ergonomics on `POST /api/v1/sessions` (returning both `instructorToken` and `participantToken` and starting directly in `round-1:chain-mapping`).
5. Discriminated-union adjudication actions supporting peer voting (`peer-approve`, `peer-challenge`), on-demand AI evaluation (`ai-evaluate`), and permanent **Instructor Final Ruling** locks (`instructor-approve`, `instructor-reject`).
6. Strict one-shot and completeness invariants on Pretest and Posttest **Assessment Attempts** requiring an explicit candidate choice (`0..3`) or `"I_DONT_KNOW"` for every question.

## User Stories

1. As a frontend or mobile client developer, I want a valid OpenAPI 3.1.0 YAML specification, so that I can generate strongly typed API clients and validate request/response payloads automatically.
2. As an API consumer, I want every `4xx` and `5xx` response across all endpoints to return a uniform `ApiErrorResponse` object containing `code` (from a fixed enum of 15 machine-readable codes), `message`, and optional structured `details`, so that my client can handle errors deterministically without parsing human prose.
3. As an anonymous visitor, I want `GET /api/v1/packs` to return `200 OK` with a list of `CurriculumPackSummary` objects (`id`, `title`, `version`, `subjectDomain`, `boardConfig`, `cardCount`, `domainCount`, `hasAssessmentInstrument`, `hasPerceptionSurvey`), so that I can browse available games like *Diabe-teach* without authenticating.
4. As a learner or anonymous caller, I want `GET /api/v1/packs/{packId}` to return `200 OK` with `PublicCurriculumPack` where every question in `assessmentInstrument.questions` omits `correctIndex` and `explanation`, so that inspecting the network tab never reveals quiz answers before the Posttest.
5. As an instructor providing a valid `Bearer <instructorToken>` header on `GET /api/v1/packs/{packId}`, I want the response to include the complete `FullCurriculumPack` (including `correctIndex` and `explanation`), so that I can preview the full assessment key during class preparation.
6. As an API consumer requesting a non-existent `packId` on `GET /api/v1/packs/{packId}`, I want to receive `404 Not Found` with `code: "PACK_NOT_FOUND"`, so that missing packs are clearly reported.
7. As a game creator authoring a new Curriculum Pack, I want `POST /api/v1/packs/validate` to accept a draft `CurriculumPackInput` payload and **always return `200 OK`** with `{ valid: boolean, issues: PackValidationIssue[] }` (where each issue specifies `jsonPointer`, `rule`, and `message`), so that authoring tools can display all broken invariants without catching HTTP error statuses.
8. As a game creator publishing a new Curriculum Pack via `POST /api/v1/packs`, I want to receive `201 Created` with `{ pack: CurriculumPackSummary }` when valid, `409 Conflict` (`code: "PACK_ALREADY_EXISTS"`) if the `pack.id` is already registered, or `422 Unprocessable Entity` (`code: "PACK_VALIDATION_FAILED"`) with `details.issues` if any pack invariant fails.
9. As an instructor creating a `classroom` or `study-rct` Game Session via `POST /api/v1/sessions`, I want to pass `{ packId, mode, adjudicationMode, timerConfig?, seed?, creatorDisplayName? }` and receive `201 Created` with `{ sessionId, roomCode, instructorToken, state }`, where `state` starts in `trial-orientation` (for `classroom`) or `pretest` (for `study-rct`).
10. As a solo learner creating a `solo` Game Session via `POST /api/v1/sessions`, I want the server to automatically enroll me as the sole participant, initialize the session directly in `round-1` (`chain-mapping` sub-phase) with a freshly shuffled board grid, and return **both** `instructorToken` and `participantToken` alongside `participantId` in the `201 Created` response, so that I can begin building Concept Chains immediately without a second `/join` request.
11. As a classroom learner, I want to call `POST /api/v1/sessions/join` with `{ roomCode, displayName? }` and receive `200 OK` with `{ sessionId, participantId, participantToken, state }`, or `404 Not Found` (`code: "ROOM_CODE_NOT_FOUND"`) if the room code does not exist.
12. As a connected client, I want `GET /api/v1/sessions/{sessionId}` to return `200 OK` with the current `PublicSessionState` snapshot (including active phase, `endsAtMs`, current round's seeded `BoardGrid`, participants, submitted Concept Chains for the active/completed rounds, and current standings), or `404 Not Found` (`code: "SESSION_NOT_FOUND"`).
13. As a connected client, I want `GET /api/v1/sessions/{sessionId}/stream` to establish a `text/event-stream` Server-Sent Events connection emitting typed events (`session.snapshot`, `participant.joined`, `phase.changed`, `chain.submitted`, `chain.adjudicated`, `standings.updated`), so that classroom timers, board reshuffles, and peer reviews stay synchronized in real time.
14. As an instructor (or solo participant), I want to call `POST /api/v1/sessions/{sessionId}/phase` with `Bearer <instructorToken>` (or `participantToken` in `solo` mode) and `{ action: "advance" | "jump", targetPhase?, seed? }`, so that the session transitions deterministically to the next phase and deals a newly shuffled `BoardGrid` whenever entering `round-1:chain-mapping` or `round-2:chain-mapping`.
15. As an API consumer, I want `POST /api/v1/sessions/{sessionId}/phase` to return `401 Unauthorized` (`UNAUTHORIZED_TOKEN`) if no valid token is supplied, `403 Forbidden` (`FORBIDDEN_ROLE`) if a classroom participant attempts to advance the instructor's phase, and `409 Conflict` (`INVALID_PHASE_TRANSITION`) if the requested transition violates the session mode's state machine.
16. As a learner during the 20-minute `chain-mapping` sub-phase, I want to submit a Concept Chain via `POST /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains` with `Bearer <participantToken>` and `{ path: GridCoord[], narrativeExplanation: string, stepRationales?: StepRationale[] }`, receiving `201 Created` with the recorded `SubmittedChain` object.
17. As a learner who attempts to submit a Concept Chain when the round is not in the `chain-mapping` sub-phase, I want `POST .../chains` to reject the request with `409 Conflict` (`code: "PHASE_CLOSED_FOR_SUBMISSIONS"`), so that the 20-minute mapping cutoff is strictly enforced.
18. As a learner who submits a topologically invalid Concept Chain, I want `POST .../chains` to return `422 Unprocessable Entity` with `code: "CHAIN_TOPOLOGY_INVALID"` and `details: { reason: "CHAIN_TOO_SHORT" | "OUT_OF_BOUNDS" | "DUPLICATE_CELL" | "NON_ADJACENT_TRANSITION", brokenTransitionIndex?: number }`, so that the UI can highlight the exact offending card transition on the grid.
19. As a learner in a session with `adjudicationMode: "ai"`, I want `POST .../chains` to immediately evaluate my Concept Chain against the pack's Adjudication Rubric and return the populated `AdjudicationVerdict` (`isApproved`, `adjudicatorType: "ai-specialist"`, `qualityScore`, `transitionEvaluations`, `overallFeedback`, `suggestedRefinements`) inside the `201 Created` response.
20. As a learner in a session with `adjudicationMode: "peer-instructor"` or `"hybrid"`, I want `POST /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/{chainId}/adjudicate` with `Bearer <participantToken>` and `{ action: "peer-approve" | "peer-challenge", comment? }` to record or update my single peer vote on that chain and return `200 OK` with the updated chain state.
21. As an instructor, I want `POST /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/{chainId}/adjudicate` with `Bearer <instructorToken>` and `{ action: "instructor-approve" | "instructor-reject", feedback: string, qualityScore?: number }` to issue an **Instructor Final Ruling** that sets `verdict.adjudicatorType = "instructor-final"` and `verdict.isLocked = true`.
22. As a participant or instructor, if anyone attempts to cast a peer vote or trigger `ai-evaluate` on a chain whose verdictAlready has `isLocked === true`, I want `POST .../adjudicate` to return `409 Conflict` (`code: "ADJUDICATION_LOCKED_BY_INSTRUCTOR"`), preserving the supervising instructor's supreme authority as required by the *Diabe-teach* RCT protocol.
23. As a learner or instructor, I want `GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/standings` to return `200 OK` with `{ roundNumber, isFinalized, standings: PlayerRoundStanding[] }`, where duplicate coordinate paths by the same participant are deduplicated and participants are ranked by `longestValidChainLength` DESC, then `totalValidChainsCount` DESC, then `cumulativeRationaleScore` DESC.
24. As a learner submitting an **Assessment Attempt** to `POST /api/v1/sessions/{sessionId}/assessments/{stage}` (`stage = "pretest" | "posttest"`), I want the server to require an explicit answer (`0 | 1 | 2 | 3 | "I_DONT_KNOW"`) for every question ID in the pack's `assessmentInstrument`, returning `422 Unprocessable Entity` (`code: "ASSESSMENT_INCOMPLETE"`, `details: { missingQuestionIds }`) if any question is omitted.
25. As a study administrator, I want `POST /api/v1/sessions/{sessionId}/assessments/{stage}` to enforce a one-shot invariant per participant and stage, returning `409 Conflict` (`code: "ASSESSMENT_ALREADY_SUBMITTED"`) if a participant tries to re-submit their Pretest or Posttest.
26. As a learner submitting `POST .../assessments/pretest`, I want the `201 Created` response to return only `{ stage: "pretest", participantId, recordedCount, submittedAt }` without any score or item correctness, so that Pretest submission never leaks answers before gameplay and Posttest.
27. As a learner submitting `POST .../assessments/posttest`, I want the `201 Created` response to return `{ stage: "posttest", participantId, submittedAt, report: LearnerMetacognitiveReport, answerKeyReview: QuestionReviewItem[] }`, so that I immediately see my Pretest vs. Posttest improvement, my **Uncertainty Calibration**, and the full clinical explanations after finishing the Posttest.
28. As a learner, I want `POST /api/v1/sessions/{sessionId}/survey` with `Bearer <participantToken>` and `{ responses: Record<surveyItemId, 1 | 2 | 3 | 4 | 5>, comments?: string }` to record my 5-point Likert ratings and return `201 Created`.
29. As a learner calling `GET /api/v1/sessions/{sessionId}/analytics` with `Bearer <participantToken}`, I want to receive my personal `LearnerMetacognitiveReport` alongside anonymized cohort summary averages.
30. As an instructor calling `GET /api/v1/sessions/{sessionId}/analytics` with `Bearer <instructorToken}`, I want to receive the full `CohortAnalyticsReport` containing Pretest and Posttest distributions (Correct %, Wrong Guess %, *"I don't know"* %, mean, SD, Uncertainty Calibration Ratio), Cross-Domain **Chain Diversity Index**, 5-point Likert response distributions, and the `rows × cols` **Board Neglect Heatmap**.

## Implementation Decisions

- **OpenAPI 3.1.0 Document Structure**:
  - Target artifact: `docs/api/openapi.yaml` (using OpenAPI `3.1.0` and JSON Schema draft 2020-12 keywords such as `const`, `oneOf` with `discriminator`, and nullable type arrays `[string, "null"]`).
  - Organizes operations under 4 tags: `Packs`, `Sessions`, `Chains`, and `Assessments & Analytics`.
- **Security Scheme & Role Enforcement**:
  - Defines `components.securitySchemes.BearerAuth` (`type: http`, `scheme: bearer`, `bearerFormat: SessionCapabilityToken`).
  - Public endpoints (`GET /api/v1/packs`, `POST /api/v1/packs/validate`, `POST /api/v1/packs`, `POST /api/v1/sessions`, `POST /api/v1/sessions/join`, `GET /api/v1/sessions/{sessionId}`, `GET /api/v1/sessions/{sessionId}/stream`, `GET .../standings`) require no token, while `GET /api/v1/packs/{packId}` accepts optional `BearerAuth` to conditionally include instructor-only assessment answer keys.
  - Participant-authenticated endpoints (`POST .../chains`, `POST .../assessments/{stage}`, `POST .../survey`) require `participantToken`.
  - Instructor-authenticated endpoints (`POST /api/v1/sessions/{sessionId}/phase` in classroom/study-rct modes, and `instructor-approve` / `instructor-reject` actions on `POST .../adjudicate`) require `instructorToken` (with `participantToken` also permitted on `/phase` when `session.mode === "solo"`).
- **Canonical Machine-Readable Error Enum (`ApiErrorCode`)**:
  - All error responses reference `#/components/schemas/ApiErrorResponse`, whose `code` field is constrained to:
    1. `INVALID_REQUEST_BODY` (`400`)
    2. `UNAUTHORIZED_TOKEN` (`401`)
    3. `FORBIDDEN_ROLE` (`403`)
    4. `PACK_NOT_FOUND` (`404`)
    5. `SESSION_NOT_FOUND` (`404`)
    6. `ROOM_CODE_NOT_FOUND` (`404`)
    7. `CHAIN_NOT_FOUND` (`404`)
    8. `PACK_ALREADY_EXISTS` (`409`)
    9. `INVALID_PHASE_TRANSITION` (`409`)
    10. `PHASE_CLOSED_FOR_SUBMISSIONS` (`409`)
    11. `ADJUDICATION_LOCKED_BY_INSTRUCTOR` (`409`)
    12. `ASSESSMENT_ALREADY_SUBMITTED` (`409`)
    13. `PACK_VALIDATION_FAILED` (`422`)
    14. `CHAIN_TOPOLOGY_INVALID` (`422`)
    15. `ASSESSMENT_INCOMPLETE` (`422`)
- **Discriminated Union Schemas**:
  - `AdjudicateChainRequest` uses `oneOf` discriminated by `action`:
    - `PeerVoteRequest` (`action: "peer-approve" | "peer-challenge"`, optional `comment`)
    - `AiEvaluateRequest` (`action: "ai-evaluate"`)
    - `InstructorRulingRequest` (`action: "instructor-approve" | "instructor-reject"`, required `feedback`, optional `qualityScore: 1..10`)
  - `AssessmentSubmissionResponse` uses `oneOf` discriminated by `stage`:
    - `PretestSubmissionReceipt` (`stage: "pretest"`, `participantId`, `recordedCount`, `submittedAt`)
    - `PosttestSubmissionResult` (`stage: "posttest"`, `participantId`, `submittedAt`, `report: LearnerMetacognitiveReport`, `answerKeyReview: QuestionReviewItem[]`)
- **Server-Sent Events (`GET /api/v1/sessions/{sessionId}/stream`)**:
  - Documented with `text/event-stream` media type and a structured `SseEventPayload` schema covering event types `session.snapshot`, `participant.joined`, `phase.changed`, `chain.submitted`, `chain.adjudicated`, and `standings.updated`.

## Testing Decisions

- **Primary Testing Seam (OpenAPI Contract & HTTP Application Boundary)**:
  - The OpenAPI 3.1 YAML specification itself will be validated for structural and JSON Schema 2020-12 compliance.
  - Every HTTP response returned by the application handler seam (`createApp(...)`) in integration tests will be asserted against the OpenAPI 3.1 response schemas and status codes defined in this spec.
- **What Makes a Good Test**:
  - Contract tests verify observable HTTP status codes, headers, and JSON response payloads for both happy paths and every single `ApiErrorCode` edge case:
    1. `GET /api/v1/packs/diabe-teach` omits `correctIndex` without a token, and includes `correctIndex` when called with a valid `instructorToken`.
    2. `POST /api/v1/packs/validate` returns `200 OK` with `valid: false` and structured `issues` when given an invalid pack (e.g., fewer cards than `rows * cols`).
    3. `POST /api/v1/sessions` with `mode: "solo"` returns `201 Created` with both `instructorToken` and `participantToken` and starts in `round-1:chain-mapping`.
    4. `POST .../chains` returns `422 CHAIN_TOPOLOGY_INVALID` with `brokenTransitionIndex: 1` when given *Diabe-teach* Figure 2 Invalid Chain C (`Autoimmune` $\to$ `Islet Cells` $\to$ `Pancreas` $\to$ `Retinopathy`), and `409 PHASE_CLOSED_FOR_SUBMISSIONS` when called during `peer-adjudication`.
    5. `POST .../adjudicate` with `instructor-approve` locks the chain (`isLocked: true`), and a subsequent `peer-challenge` returns `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`.
    6. `POST .../assessments/pretest` rejects missing questions with `422 ASSESSMENT_INCOMPLETE`, rejects a second attempt with `409 ASSESSMENT_ALREADY_SUBMITTED`, and omits scores/answers on `201 Created`, whereas `POST .../assessments/posttest` returns the full `LearnerMetacognitiveReport` and `answerKeyReview`.

## Out of Scope

- GraphQL or gRPC transport definitions (the platform uses HTTP REST + SSE exclusively).
- Third-party OAuth2 / OpenID Connect identity provider flows.
- Rate-limiting or CDN/WAF infrastructure headers.

## Further Notes

- Parent Platform Spec: [`.scratch/concept-chain-api/spec.md`](../concept-chain-api/spec.md)
- Related ADR: [`docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md`](../../docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md)
- Domain Glossary: [`GLOSSARY.md`](../../GLOSSARY.md)
