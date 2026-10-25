# Spec: Subject-Agnostic Curriculum Pack Catalog & Game Platform API

Status: ready-for-agent

## Problem Statement

Medical educators, learners, and educational game creators currently lack a reusable digital platform and API to run associative concept-chaining board games like *Diabe-teach*. In the physical tabletop format evaluated in the *Diabe-teach* randomized controlled trial, instructors must manually print, cut, and shuffle 49 Keyword Cards into a 7×7 grid before every round, manually verify whether proposed Concept Chains touch horizontally or diagonally, verbally adjudicate every chain transition within a tight 10-minute window, manually tally longest-chain winners and total-chain tie-breakers, and separately administer and grade Pretest/Posttest assessments (including *"I don't know"* metacognitive tracking) and Likert perception surveys.

Furthermore, if the software is hardcoded exclusively to the 49 Diabetes Mellitus terms and an endocrinology judge persona, educators in other disciplines (such as Cardiology, Pharmacology, Neuroanatomy, or non-medical fields) cannot reuse the platform to create and run their own concept-chaining games without rewriting the engine and API.

## Solution

Provide a subject-agnostic **Curriculum Pack Catalog** and a server-authoritative **HTTP REST + Server-Sent Events (SSE) API** (`/api/v1/*`) paired with an isomorphic board topology validator that powers both **Diabe-teach** (built-in out of the box with all 49 canonical keywords, 7 Semantic Domains, Figure 2 Calibration Examples, 10 Bloom Level 2/3 Pretest/Posttest questions, and 9 Likert survey items) and any custom **Curriculum Pack** created for other subjects.

The API manages:
1. **Curriculum Pack Discovery, Authoring & Validation (`/api/v1/packs`)**: Listing available games, fetching public pack configurations (with assessment answer keys stripped), validating custom pack payloads against structural and topological invariants, and registering new packs.
2. **Game Sessions & Classroom Synchronization (`/api/v1/sessions`)**: Creating Solo Practice, Classroom Game, or full Study RCT sessions with lightweight session-scoped capability tokens (`instructorToken` and `participantToken`), joining via room code, enforcing timed phase transitions (Pretest $\to$ Trial Orientation $\to$ Gameplay Round 1 [20m Chain-Mapping + 10m Peer-Adjudication] $\to$ Gameplay Round 2 [with mandatory deck reshuffle] $\to$ Posttest $\to$ Feedback Survey), and broadcasting live state updates over Server-Sent Events (`GET /api/v1/sessions/:sessionId/stream`).
3. **Concept Chain Submission, Narrative Adjudication & Round Scoring (`/api/v1/sessions/:sessionId/rounds/:roundNumber/chains`)**: Validating physical board adjacency, orchestrating Narrative Adjudication (via AI using the pack's Adjudication Rubric, peer consensus voting, or supervising instructor final override), and computing round standings (longest approved chain primary rank, total distinct approved chains tie-breaker).
4. **Assessments, Perception Surveys & Metacognitive Analytics (`/api/v1/sessions/:sessionId/assessments`, `/survey`, `/analytics`)**: Capturing Pretest and Posttest Assessment Attempts while preserving answer-key secrecy until Posttest completion, separating wrong guesses from explicit *"I don't know"* responses to compute Uncertainty Calibration, and generating cross-domain Chain Diversity and board neglect heatmaps.

## User Stories

1. As a learner, I want to browse all registered Curriculum Packs via `GET /api/v1/packs`, so that I can select *Diabe-teach* or another subject pack to study.
2. As a learner, I want to fetch the public definition of a Curriculum Pack via `GET /api/v1/packs/:packId`, so that my client can render the Keyword Cards, Semantic Domains, board dimensions, and Trial Round Calibration Examples.
3. As a game creator or educator, I want to submit a draft Curriculum Pack payload to `POST /api/v1/packs/validate`, so that I receive a complete list of structural or topological errors (such as duplicate Keyword Card IDs, alias collisions, missing Semantic Domains, fewer cards than `rows * cols`, or invalid Calibration Example coordinates) before publishing.
4. As a game creator or educator, I want to configure custom board dimensions (`rows`, `cols`), minimum chain length (`minChainLength`), and adjacency rules (`chebyshev-8` or `orthogonal-4`) in my Curriculum Pack, so that I can create smaller introductory games (e.g., 5×5 with 3-card chains) or standard 7×7 games.
5. As a game creator or educator, I want to include a card pool larger than `rows * cols` in a Curriculum Pack, so that each Gameplay Round deals a fresh seeded subset of `rows * cols` Keyword Cards onto the board while keeping *Diabe-teach*'s exact 49-card behavior when `cards.length === rows * cols`.
6. As a game creator or educator, I want to define an Adjudication Rubric (evaluator persona, subject domain, continuity criteria, and Calibration Examples) inside my Curriculum Pack, so that the Narrative Adjudicator grades Concept Chains accurately for my subject without any hardcoded diabetes logic.
7. As a game creator or educator, I want Pretest/Posttest assessment banks and perception surveys to be optional on a Curriculum Pack, so that I can publish a standalone playable game pack without being forced to author a clinical trial questionnaire.
8. As a game creator or educator, I want to register a validated Curriculum Pack via `POST /api/v1/packs`, so that it becomes immediately playable in new Game Sessions.
9. As an instructor, I want to create a new Game Session via `POST /api/v1/sessions` specifying the `packId`, session mode (`solo`, `classroom`, or `study-rct`), and adjudication mode (`ai`, `peer-instructor`, or `hybrid`), so that I receive a `sessionId`, a shareable `roomCode`, and an `instructorToken`.
10. As a learner, I want to join an active Classroom or Study RCT Game Session via `POST /api/v1/sessions/join` using only a `roomCode` (and optional display alias), so that I receive an anonymous `participantId` and `participantToken` without needing to register an account or share personal data.
11. As a solo learner, I want to start a `solo` Game Session in a single API call, so that I can immediately practice building Concept Chains and receive instant AI Narrative Adjudication feedback.
12. As a connected client (learner or instructor), I want to subscribe to `GET /api/v1/sessions/:sessionId/stream` via Server-Sent Events, so that my screen updates in real time whenever the phase changes, a new board is shuffled, a timer starts, a Concept Chain is presented, or round standings update.
13. As a connected client, I want to fetch the complete current state snapshot via `GET /api/v1/sessions/:sessionId`, so that I can recover seamlessly if my network connection drops or if I refresh the browser mid-round.
14. As an instructor running a `study-rct` session, I want the session to start in the 15-minute `pretest` phase, so that baseline learner knowledge and baseline Uncertainty Calibration are recorded before any exposure to the Keyword Cards.
15. As a learner taking the Pretest or Posttest, I want every multiple-choice question to present 4 substantive options alongside a 5th explicit *"I don't know"* option, so that I can honestly report knowledge gaps rather than being forced to guess blindly.
16. As a study administrator, I want `GET /api/v1/packs/:packId` and `POST /api/v1/sessions/:sessionId/assessments/pretest` to strip the correct answer index (`correctIndex`) and item-level correctness from learner responses until the learner completes the Posttest, so that taking the Pretest does not leak answers for the identical Posttest questions.
17. As an instructor, I want to transition the session from `pretest` to the 15-minute `trial-orientation` phase via `POST /api/v1/sessions/:sessionId/phase` (authenticated with `instructorToken`), so that learners can inspect the pack's Calibration Examples (such as *Diabe-teach* Figure 2 Chains A, B, and C) and practice forming chains.
18. As an instructor, I want transitioning from `trial-orientation` to `round-1` (and from `round-1` to `round-2`) to automatically reshuffle the deck with a new cryptographic/PRNG seed into a fresh board grid, so that familiarity with the Trial Round board layout provides no unfair advantage in competitive gameplay.
19. As a classroom learner, I want all participants in the same Game Session to receive the exact same seeded board grid during a Gameplay Round, so that everyone competes on an identical layout.
20. As a learner during the 20-minute `chain-mapping` sub-phase, I want my client to run the shared pure topology validator locally as I drag or tap across Keyword Cards, so that legal adjacent neighbors (`ChebyshevDistance === 1`) highlight in $0\text{ms}$ and invalid leaps (like *Diabe-teach* Figure 2 Chain C between `Islet Cells` and `Pancreas`) are prevented immediately.
21. As a learner during the 20-minute `chain-mapping` sub-phase, I want to submit a proposed Concept Chain (ordered grid coordinates + narrative explanation) to `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains`, so that the server validates its topology and records it for the round.
22. As a learner, I want the server to reject any Concept Chain submission that has fewer than `minChainLength` cards (4 in *Diabe-teach*), contains out-of-bounds coordinates, repeats a cell within the same chain, or contains a non-adjacent step, returning a structured error identifying the exact broken transition index.
23. As a learner, I want the server to reject new Concept Chain creation once the 20-minute `chain-mapping` sub-phase has ended and the round has entered the 10-minute `peer-adjudication` sub-phase, so that all participants adhere to the round timer.
24. As a learner in `ai` or `hybrid` adjudication mode, I want the Narrative Adjudicator to evaluate each pairwise transition ($C_i \to C_{i+1}$) in my submitted Concept Chain against the pack's Adjudication Rubric, returning an overall approval verdict, a quality score ($1\text{–}10$), per-transition commentary, and suggested refinements.
25. As a learner in `peer-instructor` classroom mode during the 10-minute `peer-adjudication` sub-phase, I want to submit a peer vote (`approve` or `challenge` with a comment) on a presented Concept Chain via `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate` using my `participantToken`, so that the class can reach peer consensus or surface clinical/conceptual disputes.
26. As an instructor during the `peer-adjudication` sub-phase, I want to submit a final ruling (`approve` or `reject` with feedback) on any Concept Chain via `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate` using my `instructorToken`, so that the supervising instructor acts as the supreme arbiter whose decision is final.
27. As a learner or instructor, I want to query `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/standings`, so that I can see the round leaderboard ranked primarily by the **longest approved Concept Chain** and secondarily (on ties) by the **greatest total count of distinct approved Concept Chains**.
28. As a fair-play safeguard, I want the scoring engine to deduplicate identical coordinate paths submitted multiple times by the same participant within a single round, so that a participant cannot inflate their tie-breaker chain count by re-submitting the same path with slightly reworded explanations.
29. As a learner in a `study-rct` session, I want to submit my Posttest Assessment Attempt to `POST /api/v1/sessions/:sessionId/assessments/posttest` after Gameplay Round 2 concludes, so that I receive my Pretest vs. Posttest comparison and unlock the full answer key and explanations.
30. As a learner, I want to submit my 5-point Likert perception ratings (`1 = highly disagree` to `5 = highly agree`) to `POST /api/v1/sessions/:sessionId/survey`, so that anonymous engagement, communication, confidence, and stress-level feedback is captured.
31. As an instructor or researcher, I want to fetch `GET /api/v1/sessions/:sessionId/analytics`, so that I receive individual and cohort-level metrics matching the *Diabe-teach* RCT (Pretest vs. Posttest Correct %, Wrong Guess %, *"I don't know"* %, Uncertainty Calibration Ratio, Cross-Domain Chain Diversity Index, and a 7×7 Board Neglect Heatmap showing which Keyword Cards were never chained).
32. As a domain engineer, I want all `GameSession` and `CurriculumPack` business invariants to live inside a pure, zero-I/O Domain Ring with no imports from HTTP routers, LLM SDKs, or serverless runtime libraries, so that pedagogical and clinical rules remain portable and deterministic.
33. As an application architect, I want all external capabilities—persistence, AI Narrative Adjudication, real-time SSE event publishing, wall-clock time, and random/ID generation—to be defined as outbound Driven Ports in the Application Ring, so that production adapters and deterministic test doubles can be swapped at the composition root without touching domain or use-case code.
34. As a platform maintainer, I want inward-only hexagonal dependency rules enforced automatically at build/lint time, so that neither the Domain Ring nor the Application Ring can accidentally import from Driving or Driven Adapters, and Driving and Driven Adapters cannot import each other directly.
35. As a DevOps or platform engineer, I want the entire HTTP REST + SSE API (`/api/v1/*`) deployed through a single catch-all Netlify Functions v2 composition root delegating to a Web-Standard Fetch (`Request` $\to$ `Response`) Driving Adapter, so that cold-start overhead is minimized and the full HTTP application can be tested in-process without booting a serverless emulator.
36. As a classroom instructor or learner running on serverless Netlify Functions, I want `GameSession` and custom `CurriculumPack` state persisted via a Netlify Blobs Driven Adapter using ETag optimistic concurrency control, so that concurrent Concept Chain submissions, peer votes, or phase transitions across stateless function invocations never overwrite each other.
37. As a connected classroom client subscribed to the SSE stream on Netlify Functions v2, I want the stream to emit an immediate `session.snapshot` event along with standard SSE `id:` and `retry:` reconnection directives over a Web `ReadableStream`, so that my client seamlessly maintains real-time state across serverless invocation lifecycles.

## Implementation Decisions

- **Hexagonal Architecture (Ports & Adapters) & Inward-Only Dependency Ring (per ADR-0002)**:
  - The backend is organized into four strict concentric rings plus a serverless composition root:
    1. **Domain Ring**: Contains only pure, synchronous, deterministic Domain-Driven Design (DDD) building blocks (Aggregate Roots, Entities, Value Objects, stateless Domain Services, Domain Events, and typed `DomainError` subclasses). Forbidden from importing Application, Adapters, HTTP primitives, Node/serverless I/O, `Date.now()`, or `Math.random()`.
    2. **Application Ring**: Contains use-case command/query orchestrators, Role-Aware DTO projection mappers, inbound **Driving Ports**, and outbound **Driven Ports**. Depends exclusively on the Domain Ring.
    3. **Driving Adapters Ring**: Contains the HTTP REST + SSE Driving Adapter built on Web-Standard `Request` and `Response` primitives (`createApp(deps)`). Responsible for authentication token extraction (`BearerAuth`), request schema validation, invoking Application use cases, and serving as the single translation layer mapping `DomainError` instances to the 15 canonical OpenAPI `ApiErrorCode` responses.
    4. **Driven Adapters Ring**: Contains concrete implementations of the outbound Driven Ports (In-Memory and Netlify Blobs persistence adapters, LLM and deterministic fixture Narrative Adjudicator adapters, SSE event publisher adapters, clock, and ID/seed generators). Driving and Driven Adapters never import one another directly.
    5. **Composition Root**: The Netlify Functions v2 entry point and test harnesses are the only modules permitted to instantiate Driven Adapters and inject them into the HTTP Driving Adapter.
  - Automated architectural boundary checks (`dependency-cruiser`) enforce these inward-only import rules and reject circular dependencies or cross-adapter coupling.
- **Domain-Driven Design (DDD) Tactical Model**:
  - **Aggregate Roots (Transactional Consistency Boundaries)**:
    - `GameSession`: The primary stateful Aggregate Root owning its `GameplayRound` entities, participant roster, capability token hashes (`instructorToken`, `participantToken`), submitted `ConceptChain` entities, `AdjudicationVerdict` states, `AssessmentAttempt` records, perception survey responses, and timed phase state machine. All mutations (joining, advancing phases with mandatory board seed reshuffle, recording a Concept Chain prior to the 20-minute `chain-mapping` cutoff, casting peer votes, locking an `InstructorFinalRuling`, and recording one-shot Pretest/Posttest attempts) execute as invariant-enforcing methods on `GameSession`.
    - `CurriculumPack`: Read-mostly Aggregate Root identified by `PackId`, bundling `KeywordCard` items, `SemanticDomain` definitions, `AdjudicationRubric`, `CalibrationExample` fixtures, and optional assessment/survey instruments.
  - **Value Objects**:
    - `GridCoord`, `BoardGrid`, `ChainPath`, `AdjudicationRubric`, `CalibrationExample`, `AdjudicationVerdict`, `PlayerRoundStanding`, `UncertaintyCalibration`, `ChainDiversityIndex`, and `BoardNeglectHeatmap` are immutable and compared by value.
  - **Stateless Domain Services**:
    - `BoardTopologyService`: Deterministic seeded PRNG board dealing (`rows × cols`) and chain path validation (`minChainLength`, bounds, cell uniqueness, and `chebyshev-8` or `orthogonal-4` adjacency).
    - `CurriculumPackValidatorService`: Structural and topological validation of draft Curriculum Packs returning exhaustive validation issues (`jsonPointer`, `rule`, `message`).
    - `RoundScoringService`: Per-participant coordinate-path deduplication and leaderboard ranking (`longestValidChainLength` DESC, `totalValidChainsCount` DESC, `cumulativeRationaleScore` DESC).
    - `MetacognitiveAnalyticsService`: Pretest/Posttest scoring separating Correct %, Wrong Guess %, and explicit `"I_DONT_KNOW"` % to compute `UncertaintyCalibration`, Cross-Domain `ChainDiversityIndex`, and `BoardNeglectHeatmap`.
- **Subject-Agnostic Engine & Pluggable Curriculum Packs (per ADR-0001)**:
  - All game mechanics, topological validation, round scoring, session phase state transitions, and API routes are 100% subject-agnostic.
  - Domain content lives inside immutable `CurriculumPack` definitions managed through `CurriculumPackRepositoryPort`, with `DIABE_TEACH_PACK` pre-registered by default.
  - Each `CurriculumPack` specifies:
    - `id`, `title`, `version`, `description`
    - `boardConfig`: `rows` (default `7`), `cols` (default `7`), `minChainLength` (default `4`), `adjacencyRule` (`"chebyshev-8"` | `"orthogonal-4"`, default `"chebyshev-8"`)
    - `domains`: list of `SemanticDomain` definitions (`id`, `label`, `description`)
    - `cards`: list of `KeywordCard` items (`id`, `verbatimLabel`, `displayLabel`, `aliases`, `domainId`, `clinicalOrConceptSummary`), with invariant `cards.length >= rows * cols`
    - `adjudicationRubric`: `evaluatorPersona`, `subjectDomain`, `chainContinuityCriteria`, and `calibrationExamples` (worked valid and invalid Concept Chains on a reference board layout)
    - `assessmentInstrument` *(optional)*: list of Bloom Level 2/3 multiple-choice questions (`id`, `bloomLevel`, `stem`, `options` [length 4], `correctIndex` [`0..3`], `relatedKeywordIds`, `explanation`)
    - `perceptionSurvey` *(optional)*: list of 5-point Likert items (`id`, `prompt`)
- **HTTP REST + SSE API Contract (`/api/v1`)**:
  - **Pack Endpoints**:
    - `GET /api/v1/packs` $\to$ `{ packs: CurriculumPackSummary[] }`
    - `GET /api/v1/packs/:packId` $\to$ `{ pack: PublicCurriculumPack | FullCurriculumPack }` (role-aware Application projection strips `correctIndex` and `explanation` from `assessmentInstrument` questions unless a valid `instructorToken` is supplied, without mutating the `CurriculumPack` Aggregate)
    - `POST /api/v1/packs/validate` $\to$ `{ valid: boolean, issues: PackValidationIssue[] }`
    - `POST /api/v1/packs` $\to$ `{ pack: CurriculumPackSummary }` (`201 Created`, `409 Conflict`, or `422 Unprocessable Entity` with `details.issues`)
  - **Session & Room Sync Endpoints**:
    - `POST /api/v1/sessions` $\to$ creates session, returns `{ sessionId, roomCode, instructorToken, participantId?, participantToken?, state: PublicSessionState }`
    - `POST /api/v1/sessions/join` $\to$ accepts `{ roomCode, displayName? }`, returns `{ sessionId, participantId, participantToken, state: PublicSessionState }`
    - `GET /api/v1/sessions/:sessionId` $\to$ returns `{ state: PublicSessionState }`
    - `GET /api/v1/sessions/:sessionId/stream` $\to$ Server-Sent Events stream (`ReadableStream`) emitting `session.snapshot`, `participant.joined`, `phase.changed`, `chain.submitted`, `chain.adjudicated`, and `standings.updated` events
    - `POST /api/v1/sessions/:sessionId/phase` $\to$ requires `Bearer <instructorToken>` (or `participantToken` when `mode === "solo"`), transitions session to the next valid phase/sub-phase, and triggers a fresh board seed shuffle whenever entering `round-1` or `round-2`
  - **Chain & Adjudication Endpoints**:
    - `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains` $\to$ requires `Bearer <participantToken>`, validates phase is `chain-mapping` (or `solo` active round) and validates chain topology; returns `422 Unprocessable Entity` on topological failure with `brokenTransitionIndex`, or `201 Created` with the recorded chain (and immediate adjudication verdict if `adjudicationMode === "ai"`)
    - `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate` $\to$ accepts `{ action: "peer-approve" | "peer-challenge" | "ai-evaluate" | "instructor-approve" | "instructor-reject", comment?, feedback?, qualityScore? }`. Instructor actions require `Bearer <instructorToken>` and lock the chain's final verdict (`adjudicatorType: "instructor-final"`, `isLocked: true`).
    - `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/standings` $\to$ returns `{ roundNumber, isFinalized, standings: PlayerRoundStanding[] }` sorted by `longestValidChainLength` DESC, then `totalValidChainsCount` DESC (deduplicated by coordinate path), then `cumulativeRationaleScore` DESC.
  - **Assessment, Survey & Analytics Endpoints**:
    - `POST /api/v1/sessions/:sessionId/assessments/:stage` (`stage = "pretest" | "posttest"`) $\to$ requires `Bearer <participantToken>`, accepts `{ answers: Record<questionId, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> }`. Pretest responses return aggregate completion confirmation without leaking `correctIndex`; Posttest responses return full Pretest vs. Posttest summary, Uncertainty Calibration metrics, and item-by-item answer keys.
    - `POST /api/v1/sessions/:sessionId/survey` $\to$ accepts `{ responses: Record<surveyItemId, 1 | 2 | 3 | 4 | 5>, comments? }`.
    - `GET /api/v1/sessions/:sessionId/analytics` $\to$ returns role-appropriate individual (`LearnerMetacognitiveReport`) or cohort-wide (`CohortAnalyticsReport`) Pretest/Posttest distributions (Correct %, Wrong Guess %, *"I don't know"* %, Uncertainty Calibration Ratio), Cross-Domain Chain Diversity Index, and board cell usage / neglect frequency map.
- **Outbound Driven Ports & Serverless Netlify Deployment**:
  - The Application layer depends on six injected Driven Ports:
    1. `CurriculumPackRepositoryPort` (In-Memory adapter for tests/dev; Netlify Blobs adapter seeded with `diabe-teach` for production)
    2. `SessionRepositoryPort` (In-Memory adapter for tests/dev; Netlify Blobs adapter with ETag conditional write optimistic concurrency control for production)
    3. `NarrativeAdjudicatorPort` (LLM adapter in production; deterministic rubric/fixture adapter in tests)
    4. `SessionEventPublisherPort` (In-Memory pub/sub and Netlify Blobs ETag-polling stream adapter emitting Web `ReadableStream` SSE frames with `id:` and `retry:` directives)
    5. `ClockPort` (`SystemClock` in production; controllable deterministic clock in tests)
    6. `IdGeneratorPort` (Cryptographic ID/token generator in production; deterministic sequence generator in tests)
  - In production on Netlify, a single catch-all Netlify Functions v2 handler configured for `/api/v1/*` acts as the Composition Root, wiring the Netlify Blobs and LLM Driven Adapters into the Web-Standard Fetch HTTP Driving Adapter (`createApp(deps)`).

## Testing Decisions

- **Primary Testing Seam (The Web-Standard HTTP Driving Adapter Boundary)**:
  - Our highest-leverage seam is the **HTTP Application Factory** (`createApp({ packRepo, sessionRepo, narrativeAdjudicator, eventPublisher, clock, idGenerator })`), which exposes a standard `{ fetch(request: Request): Promise<Response> }` interface.
  - Rather than writing brittle unit tests coupled to internal helper classes, mocking internal module calls, or spinning up external Netlify CLI processes, integration tests exercise the full request/response lifecycle through `app.fetch(new Request("http://localhost/api/v1/..."))` using injected in-memory repositories, a deterministic clock, deterministic IDs, and a deterministic `NarrativeAdjudicatorPort` fake.
  - A secondary pure in-process seam is exposed on the stateless Domain Services (`BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, `MetacognitiveAnalyticsService`) for exhaustive table-driven and property-based edge-case testing.
  - Architectural boundary compliance (`dependency-cruiser`) is verified as part of automated checks to prove that Domain and Application rings have zero outward dependencies and tests import modules strictly through their public entry points.
- **What Makes a Good Test**:
  - Tests assert only on observable outcomes returned through the public interface (HTTP status codes, OpenAPI-compliant JSON response bodies, emitted SSE frames, and public domain return values)—never on private internal state.
  - Every empirical rule from the *Diabe-teach* paper and Hexagonal/Netlify architecture invariant is encoded as an executable test case:
    1. All 49 Appendix 1 keywords, 7 Semantic Domains, and 9 Appendix 2 survey items are present and resolvable by ID, verbatim label, display label, and alias.
    2. Figure 2 Valid Chain A (9 cards), Valid Chain B (7 cards), and Invalid Chain C (`Islet Cells` at `(2,0)` to `Pancreas` at `(0,1)` failing Chebyshev adjacency) produce exact expected verdicts.
    3. Transitioning from `trial-orientation` to `round-1` and `round-1` to `round-2` produces a newly shuffled 7×7 board grid.
    4. Round standings rank an 8-card chain above a 7-card chain, break an 8-card tie in favor of the participant with more distinct valid chains, and ignore duplicate coordinate paths submitted by the same participant.
    5. Pretest responses never expose `correctIndex`, while Posttest responses accurately separate Correct %, Wrong Guess %, and *"I don't know"* % (verifiable against Table 1 cohort ratios).
    6. A custom non-medical `CurriculumPack` (e.g., a 5×5 game with `minChainLength = 3`) can be validated, registered via `POST /api/v1/packs`, and played end-to-end through the exact same session and chain endpoints.
    7. Optimistic concurrency conflict retries on `SessionRepositoryPort` preserve concurrent participant joins, chain submissions, and peer votes without lost updates.

## Out of Scope

- Third-party OAuth / email-password user authentication and permanent student account management (sessions use anonymous participant tokens and room codes).
- Native iOS/Android mobile app wrappers (the API serves web and mobile browsers over standard HTTP/SSE).
- Voice-to-text audio transcription hardware integration (clients submit text explanations—typed or browser speech-to-text—to the chain endpoint).
- Visual drag-and-drop "Game Studio" frontend UI for authoring custom packs (the API provides `POST /api/v1/packs/validate` and `POST /api/v1/packs` so any JSON/TypeScript pack or future studio UI can plug in).

## Further Notes

- Related ADRs: [`docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md`](../../docs/adr/0001-subject-agnostic-curriculum-pack-architecture.md), [`docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md`](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
- Architectural Rule & Agent Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md)
- OpenAPI 3.1 Contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) and [`.scratch/openapi-contract/spec.md`](../openapi-contract/spec.md)
- Domain Vocabulary: [`GLOSSARY.md`](../../GLOSSARY.md)
- Primary Research Reference: [`wiki/08-module-breakdown.md`](../../wiki/08-module-breakdown.md) and [`papers/diabe-teach.pdf`](../../papers/diabe-teach.pdf)
