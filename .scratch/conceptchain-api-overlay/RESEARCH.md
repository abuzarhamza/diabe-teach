# Research: API overlay for `claudPoc/ConceptChain (Copy).html`

Status: research (input for building a developer "API overlay" button)
Date: 2026-11-17
Branch inspected: `feat/netlify-v2-local-dev-compatibility` (working tree, incl. untracked `netlify/functions/sessions/submit-assessment.ts`)

Abbreviations used in citations:
- `HTML` = `claudPoc/ConceptChain (Copy).html`
- `OAS` = `docs/api/openapi.yaml`
- `NF` = `netlify/functions/`
- `UC` = `src/application/use-cases/`
- `PORT` = `src/application/ports/`

Domain vocabulary follows `GLOSSARY.md`: the UI's "tile" is a **Keyword Card** (GLOSSARY.md:13-15, "_Avoid_: Tile"), a "topic" / keyword set is a **Curriculum Pack** (GLOSSARY.md:9-11, "_Avoid_: ... topic pack"), a "round" is a **Gameplay Round** split into **Chain-Mapping** and **Peer-Adjudication** (GLOSSARY.md:47-49), a submitted chain is a **Concept Chain** (GLOSSARY.md:51-53), the Valid/Invalid buttons are an **Instructor Final Ruling** (GLOSSARY.md:59-61), tokens are **Capability Tokens** (GLOSSARY.md:63-65). The glossary has no "Team" term; the API's equivalent is a session participant (`participantId`).

---

## 1. The prototype UI

### 1.1 Architecture: one page, no router

The prototype is a single page with no screen switching. All "screens" are panels that are on-screen together:

| Region | DOM id / selector | Lines |
|---|---|---|
| Header controls (topic, board size, New round, Create session, Projector view) | `header.top`, `#topic`, `#size`, `#newRoundWrap`/`#newRound`, `#openBuilder`, `#projector` | HTML:164-179 |
| Board (Keyword Card grid + SVG chain overlay) | `#board`, `#overlay`, `#shell`, `#sessionInfo`, `#toast` | HTML:182-193 |
| Timer panel | `#phase`, `#clock`, `#tStart`, `#tReset`, `#tSkip`, `#buildMin`, `#explainMin` | HTML:196-208 |
| Teams panel | `#addTeam`, `#teams` (radio `team-r-i`, name `team-n-i`) | HTML:210-213, 465-478 |
| Current chain builder | `#builder`, `#chainCount`, `#submit`, `#undo`, `#clear`, link inputs `#link-k` | HTML:215-223, 435-451 |
| Leaderboard | `#lb` | HTML:225-229, 505-512 |
| AI partner (hidden unless `window.claude.use("sample")` resolves) | `#aiPanel`, `#aiCheck`, `#aiExamples`, `#aiStop`, `#aiOut` | HTML:231-240, 817-820 |
| Submitted chains (facilitator) | `#chains` | HTML:242-245, 482-504 |
| Session builder (teachers) | `#setup` and all `#sb*` ids | HTML:249-298 |
| Saved sessions / share codes | `details#sbMore`, `#sbSaved`, `#sbImport`, `#sbImportBtn` | HTML:292-297 |

Projector mode is a body class, not a screen: `body.projector` hides `.side` (HTML:56-58, toggled at HTML:561).

### 1.2 "Current screen" = phase + region

The only real state machine is the timer phase `S.timer.phase ∈ {"build","explain","done"}`:
- initial state `freshState()` (HTML:331-334): `timer:{phase:"build", remaining:20*60, running:false}`
- `build → explain` on timer expiry (HTML:531) or the "End building" button (HTML:812-816)
- `explain → done` on timer expiry (HTML:532)
- `→ build` on `resetTimer()` (HTML:539), which `startRound()` calls (HTML:544-547)
- phase label rendered in `renderTimer()` (HTML:517-524)

Rounds: `S.round` goes up with no limit in `startRound(true)` (HTML:545). Earlier rounds' chains stay in `S.chains` (HTML:553).

Suggested mapping to the API `PhaseIdentifier` (OAS:833-846):

| UI `S.timer.phase` | API `currentPhase` |
|---|---|
| `build` | `round-{N}:chain-mapping` |
| `explain` | `round-{N}:peer-adjudication` |
| `done` | `round-{N}:round-summary` |
| (none) | `pretest`, `trial-orientation`, `posttest`, `feedback-survey`, `completed` |

The UI has no screens for `pretest`, `trial-orientation`, `posttest`, `feedback-survey` or `completed`.

### 1.3 Hook points for the overlay

The page has no central `showScreen()`, so the overlay has to work out context from state and events:
- **Global state object** `S` (declared `let S` at HTML:330, assigned in `start()` HTML:828-835). Read `S.timer.phase`, `S.round`, `S.team`, `S.chain`, `S.chains`, `S.topic`.
- **Render functions** to wrap or observe: `renderAll()` (HTML:822), `renderTimer()` (HTML:517), `renderBoard()` (HTML:370), `renderBuilder()` (HTML:435), `renderChains()` (HTML:482), `renderLB()` (HTML:505), `sbRender()` (HTML:573), `renderSaved()` (HTML:660).
- **Phase transitions** happen inline in `runTimer()` (HTML:528-533), `$("tSkip").onclick` (HTML:812-816) and `resetTimer()` (HTML:539). Wrapping `renderTimer` catches all three because each calls it.
- **Actions**: handlers are attached with `.onclick=` / `addEventListener` on specific ids. A capture-phase `document` click listener keyed on `event.target.closest("[id]")` / `.tile` / `button[data-act]` can map clicks to API operations without editing those handlers. Dynamic buttons: `#nrYes`/`#nrNo` (HTML:552-554), the per-chain Valid/Invalid buttons with no ids (HTML:491-494), saved-item Start/Edit/Delete with no ids (HTML:667-673).
- **Region in view**: `#setup` is reached by scrolling (`#openBuilder` → `scrollIntoView`, HTML:656). An IntersectionObserver on `#setup` vs `.main` can tell "builder" context from "game" context.
- The page snapshots state via `window.claude.hot` (HTML:329, 836-837). An overlay should not add non-serialisable data to `S`.

### 1.4 Local data (hardcoded / client-only)

- `SETS`: 15 hardcoded keyword sets `{key:{name, words:string[]}}` (HTML:303-319). `GROUPS` sorts them into optgroups (HTML:320-325).
- `S` shape (HTML:332-333): `topic, custom, size, board:string[], chain:number[] (cell indices), links:string[], chains:[], teams:string[], team, round, timer, buildMin, explainMin, nextId, minChain, core, objective, level`.
- Submitted chain record (HTML:458): `{id, team, round, tiles:number[], words:string[], links:string[], status:"pending"|"valid"|"invalid", ai?}`.
- AI review shape attached to a chain (HTML:758-759): `ai:{links:[{verdict:"sound"|"weak"|"incorrect", feedback}], overall:"valid"|"invalid", summary}`.
- Example chains `S.examples={round, chains:[{cells:number[], links:string[]}]}` (HTML:789).
- Session-builder config `sbConfig()` (HTML:627-631): `{name, level, objective, words[], core[], size, minChain, build, explain, teams}`.
- Persistence is `localStorage["conceptchain-sessions"]` only (HTML:564, 658-659). Share code is `"CC1:"+base64(JSON)` (HTML:684-685).
- The board is dealt on the client by `newBoard()` with `Math.random` shuffle, and core words are always included (HTML:337-343).
- Adjacency is checked on the client with Chebyshev-8 (`adjacent()`, HTML:345-346).

---

## 2. OpenAPI contract (`docs/api/openapi.yaml`, source of truth)

Shared definitions:
- Security schemes: `ApiKeyAuth` header `x-api-key` (OAS:486-492); `BearerAuth` = Capability Token, either `instructorToken` or `participantToken` (OAS:493-499).
- Error body `ApiErrorResponse {code: ApiErrorCode, message: string, details?: object}` (OAS:574-584). `ApiErrorCode` enum (OAS:555-572): `INVALID_REQUEST_BODY, UNAUTHORIZED_TOKEN, FORBIDDEN_ROLE, PACK_NOT_FOUND, SESSION_NOT_FOUND, ROOM_CODE_NOT_FOUND, CHAIN_NOT_FOUND, PACK_ALREADY_EXISTS, INVALID_PHASE_TRANSITION, PHASE_CLOSED_FOR_SUBMISSIONS, ADJUDICATION_LOCKED_BY_INSTRUCTOR, ASSESSMENT_ALREADY_SUBMITTED, PACK_VALIDATION_FAILED, CHAIN_TOPOLOGY_INVALID, ASSESSMENT_INCOMPLETE`.
- Path params: `sessionId: string` (OAS:502-507); `roundNumber: integer enum [1,2]` (OAS:508-514).

Resolved schemas used below:
- `BoardConfig {rows int 3..12 =7, cols int 3..12 =7, minChainLength int ≥2 =4, adjacencyRule "chebyshev-8"|"orthogonal-4"}` (OAS:586-607)
- `KeywordCard {id, verbatimLabel, displayLabel, aliases[], domainId, summary}` (OAS:620-637)
- `GridCoord {row ≥0, col ≥0}` (OAS:639-648)
- `CurriculumPackSummary {id, title, version, subjectDomain, boardConfig, cardCount, domainCount, hasAssessmentInstrument, hasPerceptionSurvey}` (OAS:737-767)
- `PublicCurriculumPack {id, title, version, description, boardConfig, domains: SemanticDomain{id,label,description}[], cards: KeywordCard[], adjudicationRubric: {evaluatorPersona, subjectDomain, chainContinuityCriteria[≥1], calibrationBoardCardIds?: string[][], calibrationExamples: {id,title,path:GridCoord[],keywordIds[],narrativeExplanation,isValid,invalidReason?}[]}, assessmentInstrument?: {questions: {id, bloomLevel 2|3, stem, options[4], relatedKeywordIds[], correctIndex?, explanation?}[]}|null, perceptionSurvey?: {items:{id,prompt}[]}|null}` (OAS:609-618, 650-735, 769-808)
- `PublicSessionState {sessionId, roomCode, packId, mode: "solo"|"classroom"|"study-rct", adjudicationMode: "ai"|"peer-instructor"|"hybrid", currentPhase: PhaseIdentifier, activeRoundNumber?: 1|2|null, phaseStartedAt, phaseEndsAt, activeBoard?: BoardGridView|null, participantCount}` (OAS:825-831, 957-996). `BoardGridView {seed, rows, cols, cells: BoardCellView{row,col,card:KeywordCard}[][]}` (OAS:929-955)
- `SubmittedChain {chainId, sessionId, roundNumber 1|2, participantId, path: GridCoord[], keywordIds[], narrativeExplanation, stepRationales?: StepRationale{fromCoord,toCoord,rationale}[], status "pending-review"|"approved"|"rejected", verdict?: AdjudicationVerdict|null, peerVotes: {voterParticipantId, decision "approve"|"challenge", comment?, votedAt}[], submittedAt}` (OAS:1011-1020, 1082-1147)
- `AdjudicationVerdict {isApproved, adjudicatorType "ai-specialist"|"peer-consensus"|"instructor-final", isLocked, qualityScore 1..10, transitionEvaluations: {fromKeywordId,toKeywordId,isSound:boolean,commentary}[], overallFeedback, suggestedRefinements?}` (OAS:1039-1080)
- `PlayerRoundStanding {rank ≥1, participantId, displayName?, longestValidChainLength, totalValidChainsCount, cumulativeRationaleScore, approvedChainIds[]}` (OAS:1196-1225)

### 2.1 Operations

| # | operationId | Method + path | Security | Request body | Success | Errors | OAS lines |
|---|---|---|---|---|---|---|---|
| 1 | `listCurriculumPacks` | GET `/api/v1/packs` | none | — | 200 `{packs: CurriculumPackSummary[]}` | — | 28-45 |
| 2 | `registerCurriculumPack` | POST `/api/v1/packs` | none | `CurriculumPackInput` (= `PublicCurriculumPack`, OAS:810-812) | 201 `{pack: CurriculumPackSummary}` | 400, 409, 422 | 46-80 |
| 3 | `validateCurriculumPack` | POST `/api/v1/packs/validate` | none | `CurriculumPackInput` | 200 `{valid: bool, issues: {jsonPointer, rule, message}[]}` | — | 82-107, 814-823 |
| 4 | `getCurriculumPackById` | GET `/api/v1/packs/{packId}` | ApiKey, or ApiKey+Bearer | — | 200 `{pack: PublicCurriculumPack}` (answer keys only with instructor token) | 401, 404 | 109-141 |
| 5 | `createGameSession` | POST `/api/v1/sessions` | none | `{packId (= "diabe-teach"), mode, adjudicationMode, timerConfig?: {pretestSec=900, trialOrientationSec=900, roundMappingSec=1200, roundAdjudicationSec=600, posttestSec=900, feedbackSurveySec=900}, seed?, creatorDisplayName?}` | 201 `{sessionId, roomCode, instructorToken, participantId?, participantToken?, state: PublicSessionState}` | 400, 404 | 143-164, 848-905 |
| 6 | `joinGameSession` | POST `/api/v1/sessions/join` | none | `{roomCode, displayName?}` | 200 `{sessionId, participantId, participantToken, state}` | 404 | 166-185, 907-927 |
| 7 | `getGameSessionState` | GET `/api/v1/sessions/{sessionId}` | none | — | 200 `{state: PublicSessionState}` | 404 | 187-206 |
| 8 | `streamGameSessionEvents` | GET `/api/v1/sessions/{sessionId}/stream` | none | — | 200 `text/event-stream` envelope `{event: session.snapshot\|participant.joined\|phase.changed\|chain.submitted\|chain.adjudicated\|standings.updated, data}` | 404 | 208-223, 1434-1449 |
| 9 | `transitionSessionPhase` | POST `/api/v1/sessions/{sessionId}/phase` | Bearer | `{action: "advance"\|"jump" (= advance), targetPhase?: PhaseIdentifier, seed?}` | 200 `{state}` | 401, 403, 404, 409 | 225-258, 998-1009 |
| 10 | `submitConceptChain` | POST `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains` | Bearer | `{path: GridCoord[] (≥2), narrativeExplanation (≥1 char), stepRationales?: StepRationale[]}` | 201 `{chain: SubmittedChain}` | 401, 404, 409 `PHASE_CLOSED_FOR_SUBMISSIONS`, 422 `CHAIN_TOPOLOGY_INVALID` | 260-302, 1022-1037 |
| 11 | `adjudicateConceptChain` | POST `.../rounds/{roundNumber}/chains/{chainId}/adjudicate` | Bearer | oneOf by `action`: `{action:"peer-approve"\|"peer-challenge", comment?}` / `{action:"ai-evaluate"}` / `{action:"instructor-approve"\|"instructor-reject", feedback (≥1 char), qualityScore? 1..10}` | 200 `{chain: SubmittedChain}` | 401, 403, 404, 409 `ADJUDICATION_LOCKED_BY_INSTRUCTOR` | 304-347, 1149-1194 |
| 12 | `getRoundStandings` | GET `.../rounds/{roundNumber}/standings` | none | — | 200 `{roundNumber, isFinalized, standings: PlayerRoundStanding[]}` | 404 | 349-376 |
| 13 | `submitAssessmentAttempt` | POST `/api/v1/sessions/{sessionId}/assessments/{stage}` (`pretest`\|`posttest`) | Bearer | `{answers: Record<questionId, 0\|1\|2\|3\|"I_DONT_KNOW">}` | 201 pretest `{stage, participantId, recordedCount, submittedAt}` / posttest `{stage, participantId, submittedAt, report: LearnerMetacognitiveReport, answerKeyReview[]}` | 401, 404, 409, 422 | 378-423, 1227-1372 |
| 14 | `submitPerceptionSurvey` | POST `/api/v1/sessions/{sessionId}/survey` | Bearer | `{responses: Record<itemId, 1..5>, comments?}` | 201 `{participantId, recordedItemCount, submittedAt}` | 401, 404, 422 | 425-461, 1374-1384 |
| 15 | `getSessionAnalytics` | GET `/api/v1/sessions/{sessionId}/analytics` | Bearer | — | 200 `{role, participantReport?, cohortSummary: CohortAnalyticsReport}` | 401, 404 | 463-482, 1386-1432 |

---

## 3. Implementation status (cross-check)

### 3.1 How routing actually works (differs from AGENTS.md)

AGENTS.md and ADR-0002 describe a single `netlify/functions/api.ts` routed by `OpenApiHttpApp` / `create-app.ts` (docs/adr/0002-...md:3). Neither file exists. `src/adapters/inbound/http/` contains only `lambda-to-v2-wrapper.ts` and `middy/{auth,domain-error}.middleware.ts`. ADR-0005 replaced in-function routers with one discrete Netlify v2 function per route (docs/adr/0005-...md:27). Every root `NF/*.ts` re-exports `NF/{packs,sessions}/*.ts` and declares `config.path`/`method` (for example `NF/create-session.ts:1-7`).

Consequence for the overlay: nothing validates requests against `openapi.yaml` at runtime. The overlay should show the OAS contract and flag where the implementation differs (section 3.3).

### 3.2 Status per operation

| operationId | Status | Handler / use case | Notes |
|---|---|---|---|
| listCurriculumPacks | implemented | `NF/list-packs.ts`, `NF/packs/list-packs.ts:11-40`, `UC/list-curriculum-packs.use-case.ts:17-23` | Returns only active (non-archived) packs (`findAllActive`). |
| registerCurriculumPack | implemented, drifts from OAS | `NF/packs/register-pack.ts:22-76` | Requires instructor token (`:25-29`); OAS has no security. Response is `{packId, version, warnings}` (`:67-75`), not `{pack: CurriculumPackSummary}`. Error body is `{error:{code,...}}` (`:41-64`), not `ApiErrorResponse`. |
| validateCurriculumPack | implemented, drifts from OAS | `NF/packs/validate-pack.ts:27-49` | Requires instructor (`:30-34`). Returns `{valid, errors[{path,code,message}], warnings[]}` (`PORT/validate-curriculum-pack.port.ts:3-26`), not `issues[{jsonPointer,rule,message}]`. |
| getCurriculumPackById | implemented | `NF/packs/get-pack-by-id.ts:17-39`, `UC/get-curriculum-pack-by-id.use-case.ts:26-46` | Answer keys only when role is instructor (`UC:34`). |
| createGameSession | implemented, partial | `NF/sessions/create-session.ts:41-55`, `UC/create-game-session.use-case.ts:27-99` | `state` has no `activeBoard` (`PORT/create-game-session.port.ts:26-37`). `seed` is ignored. Solo mode starts in `pretest` (domain default `src/domain/game-session/game-session.ts:62`), not Round 1 as the OAS summary says (OAS:147). |
| joinGameSession | implemented | `NF/sessions/join-session.ts:37-51`, `UC/join-game-session.use-case.ts:23-69` | |
| getGameSessionState | implemented, partial | `NF/sessions/get-session.ts:34-65` | Requires Bearer and a matching session (`:43-51`); OAS has no security. No `activeBoard`. |
| streamGameSessionEvents | **missing** | — | No function. Listed missing in `.scratch/api-implementation-gaps/RESEARCH.md:60-79`. |
| transitionSessionPhase | implemented, partial | `NF/sessions/transition-phase.ts:35-71`, `UC/transition-session-phase.use-case.ts:27-74` | Instructor only (`UC:30-34`). `.scratch/concept-chain-api/spec.md:104` also allows a solo participant. No board shuffle on round entry, and `seed` is ignored, although `.scratch/p0-game-session-endpoints/issues/05-transition-phase-endpoint.md:14` requires it. `jump` can only go to the next phase (`game-session.ts:129-134`). |
| submitConceptChain | implemented, drifts from OAS | `NF/sessions/submit-chain.ts:37-77`, `UC/submit-concept-chain.use-case.ts:28-105` | Participant only (`UC:31-38`). `minChainLength` is fixed at 4 and not read from the pack (`UC:25`). Reads `keywordIds` from the body (`NF:65`); OAS does not define it. `stepRationales` is `string[]` (`PORT/submit-concept-chain.port.ts:17`), but OAS says `StepRationale[]`. Response omits `sessionId`, `stepRationales`, `peerVotes`, `verdict` and adds `chainLength` (`PORT:20-30`). The route's `roundNumber` is not checked against `activeRoundNumber`. |
| adjudicateConceptChain | implemented, partial | `NF/sessions/adjudicate-chain.ts:35-77`, `UC/adjudicate-concept-chain.use-case.ts:25-108` | A missing `action` defaults to `peer-approve` (`NF:64`). `ai-evaluate` is a placeholder that always approves with `qualityScore: 75` (`UC:80-89`), outside the OAS range of 1-10. Verdict shape is `{isApproved,isLocked,feedback?,qualityScore?,decidedBy:"peer-consensus"\|"ai"\|"instructor",decidedAt}` (`src/domain/game-session/concept-chain.ts:17-24`), not OAS `AdjudicationVerdict`. `feedback` is not enforced as required. |
| getRoundStandings | implemented, drifts from OAS | `NF/sessions/get-standings.ts:34-69`, `UC/get-round-standings.use-case.ts:19-101` | Requires Bearer (`NF:44-52`). No `cumulativeRationaleScore` (`PORT/get-round-standings.port.ts:14-21`). No per-path deduplication. |
| submitAssessmentAttempt | implemented (new, untracked file) | `NF/sessions/submit-assessment.ts:43-105`, `UC/submit-assessment.use-case.ts` | Participant only (`UC:43-50`) and phase-gated (`UC:104-111`). Invalid stage returns 400 `{error:"INVALID_STAGE"}` (`NF:53-64`), a code not in the OAS enum. Domain keeps one attempt per stage per session, not per participant (`game-session.ts:192-199`). `.scratch/api-implementation-gaps/RESEARCH.md:48-54` still calls this "NOT IMPLEMENTED"; that is stale. |
| submitPerceptionSurvey | specced only | `.scratch/perception-survey/SPEC.md:17` | No use case or function. |
| getSessionAnalytics | specced only | `.scratch/api-implementation-gaps/RESEARCH.md:141-169` | No use case or function. |
| (not in OAS) archive pack | implemented | `NF/archive-pack.ts` → POST `/api/v1/packs/:packId/archive`; `NF/packs/archive-pack.ts:21-52` | Instructor only. Specced in `.scratch/pack-registration-endpoints/spec.md:15` and ADR-0006 (`docs/adr/0006-...md:36-41`). |
| (not in OAS) unarchive pack | implemented | `NF/unarchive-pack.ts`; `NF/packs/unarchive-pack.ts:21-51` | Same as archive. |
| (not in OAS) health | implemented | `NF/health.ts:3-13` → GET `/api/health` | |

### 3.3 Cross-cutting implementation facts the overlay should show

- **x-api-key on every route.** When `API_KEY` is set, `authMiddleware` checks `x-api-key` on every route (`src/adapters/inbound/http/middy/auth.middleware.ts:53-81`; `src/app-runtime.ts:77-78`). OAS declares it only on `getCurriculumPackById` (OAS:114-117).
- **Bearer is optional at the middleware level.** A missing Bearer sets `event.auth=null` (`auth.middleware.ts:115-117`). Each handler then decides whether to throw 401.
- **Error mapping.** `domain-error.middleware.ts:27-80` maps DomainError to HTTP: 401 Unauthorized; 404 PackNotFound / SessionNotFound / RoomCodeNotFound / ChainNotFound; 409 InvalidPhaseTransition / PhaseClosed / AdjudicationLocked / PackAlreadyArchived / PackNotArchived / PackAlreadyExists / AssessmentAlreadySubmitted; 403 Forbidden / PackIsSystemPack; 422 ChainTopologyInvalid / AssessmentIncomplete. Other errors (for example a `JSON.parse` failure in a handler) are not mapped, so malformed JSON does not produce the OAS 400 `INVALID_REQUEST_BODY`.
- **Error codes missing from the OAS enum.** `PACK_IS_SYSTEM_PACK`, `PACK_ALREADY_ARCHIVED`, `PACK_NOT_ARCHIVED` (`src/domain/errors/domain-errors.ts:115-146`), `INVALID_STAGE`, `MISSING_PACK_ID` (handlers).
- **Timer config is ignored after create.** The session stores `timerConfig` (`game-session.ts:58-60, 101-103`), but get, join and transition compute `phaseEndsAt` from `DEFAULT_TIMER_CONFIG` (`UC/get-game-session-state.use-case.ts:52-70`, `UC/transition-session-phase.use-case.ts:76-94`, `UC/join-game-session.use-case.ts:71-89`). Only create uses the custom config (`UC/create-game-session.use-case.ts:66-69`).
- **No server-side board.** There is no board dealing or `activeBoard` anywhere in `src/`. The only `seed` references are unused port fields (`PORT/create-game-session.port.ts:22`, `PORT/transition-session-phase.port.ts:15`).
- **No CORS.** `@middy/http-cors` is listed in `package.json:25` but nothing uses it. An HTML file opened from `file://` or another origin will be blocked unless it is served by `netlify dev` on the same origin (`netlify.toml` `[dev]` port 8888).
- **`netlify.toml` routing quirks.** It redirects `/api/v1/packs/register` to `register-pack`, a path not in OAS. Its redirects have no method conditions, while the function `config` blocks do declare methods. Both mechanisms coexist; check that POST `/api/v1/packs` reaches `register-pack` and not `list-packs` before showing it as callable.

---

## 4. Mapping: UI screen/action → API

Legend for "Impl": **yes** = handler exists; **partial** = exists but drifts from or lacks what the UI needs; **specced** = only in OAS or `.scratch`; **missing** = no API anywhere.

| # | UI context / action (source) | operationId · METHOD path | Request contract (from UI data) | Response contract → UI | Impl | Notes |
|---|---|---|---|---|---|---|
| 1 | Page load: fill Topic select (`renderTopics`, HTML:352-361; data `SETS`/`GROUPS` HTML:303-325) | `listCurriculumPacks` · GET `/api/v1/packs` | — | `packs[]` → options (`id`→value, `title`→label) | yes | The UI's 15 hardcoded sets are not packs. Only `diabe-teach` is seeded (`src/domain/curriculum-pack/diabe-teach-pack.ts`). There is no grouping field to replace `GROUPS`. |
| 2 | Topic change (`#topic` onchange, HTML:559) | `getCurriculumPackById` · GET `/api/v1/packs/{packId}` | path `packId` | `pack.cards[].displayLabel` → `words`; `pack.boardConfig` → size/minChain | yes | The UI then starts a new round with a client-dealt board (`startRound(true)`). In the API flow, topic is fixed per session; changing it means creating a new session (row 7). |
| 3 | Board size select (`#size`, HTML:560; options HTML:362-367) | — | — | — | missing | Board size comes from pack `boardConfig.rows/cols` (OAS:586-607). `CreateSessionRequest` has no size override. |
| 4 | Create session button (`#openBuilder`, HTML:656) | — | — | — | n/a | Scrolls to `#setup` only. |
| 5 | Session builder: upload, paste, add, clear, star, remove, "start from topic" (HTML:594-626) | (`getCurriculumPackById` for "start from topic") | — | — | n/a / yes | Keyword editing is client-only. "Core" keywords have no API concept. |
| 6 | Suggest keywords with AI (`#sbAI`, HTML:797-811) | — | — | — | missing | Calls `window.claude.use("sample")` on the client (HTML:818). There is no server endpoint. |
| 7 | **Start session** (`#sbStart` → `applySession`, HTML:645-655; `sbConfig` HTML:627-631) | (a) `validateCurriculumPack` POST `/api/v1/packs/validate` → (b) `registerCurriculumPack` POST `/api/v1/packs` → (c) `createGameSession` POST `/api/v1/sessions` → (d) `joinGameSession` × teams → (e) `transitionSessionPhase` ×2 (`pretest`→`trial-orientation`→`round-1:chain-mapping`) | (c) `{packId, mode:"classroom", adjudicationMode:"peer-instructor", timerConfig:{roundMappingSec: build*60, roundAdjudicationSec: explain*60}, creatorDisplayName}`; (d) `{roomCode, displayName: teams[i]}` | (c) store `sessionId`, `roomCode`, `instructorToken`, `state`; (d) store `participantId`/`participantToken` per team | partial | (a)/(b) need an instructor token, which only (c) issues (`register-pack.ts:25-29`). A custom pack also needs `cards[]` with `id, verbatimLabel, displayLabel, aliases, domainId, summary`, plus `domains`, `adjudicationRubric` and `description`. The UI collects plain strings only. `level` and `objective` have no session or pack field (closest is `description`). `minChain` only becomes `boardConfig.minChainLength`, and submit ignores it (`UC/submit-concept-chain.use-case.ts:25`). |
| 8 | Save session / saved list Start, Edit, Delete (HTML:660-683) | (closest) `registerCurriculumPack`; Delete ≈ POST `/api/v1/packs/{packId}/archive` (not in OAS) | — | — | missing | Uses localStorage only. There is no "session template" resource. |
| 9 | Copy / load share code (HTML:684-696) | (conceptually) `joinGameSession` via `roomCode` | — | — | missing | A share code is a serialised config, not a room. A room code joins a live Game Session. |
| 10 | Board render (`renderBoard`, HTML:370-395; deal `newBoard` HTML:338-343) | `getGameSessionState` · GET `/api/v1/sessions/{sessionId}` → `state.activeBoard` | path `sessionId`; Bearer (impl) | `activeBoard.cells[r][c].card.displayLabel` → `S.board[r*cols+c]` | **missing** (field) | `activeBoard` is in OAS (OAS:991-994) but no use case returns it, and no board is dealt server-side. |
| 11 | Keyword Card click / extend or shrink chain (HTML:422-431) | — | — | — | n/a | Local. Adjacency is re-checked by the server on submit (row 13). |
| 12 | Link explanation inputs (`#link-k`, HTML:443-445) | — | — | — | n/a | Feeds `stepRationales` in row 13. |
| 13 | **Submit chain** (`#submit`, HTML:454-462) | `submitConceptChain` · POST `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains` | path `roundNumber = state.activeRoundNumber` (1\|2); Bearer **participantToken of `S.team`**; body `path = S.chain.map(i=>({row:Math.floor(i/size), col:i%size}))`, `narrativeExplanation = S.links.join(" → ")` (required, the UI has no single narrative), `stepRationales` (OAS: `[{fromCoord,toCoord,rationale:S.links[k]}]`; impl: `string[]`), `keywordIds` (impl only; needs card ids the UI does not have) | 201 `chain` → `{id:chainId, team:(participantId→team index), round:roundNumber, tiles, words, links, status: "pending-review"→"pending"}` | partial | 409 `PHASE_CLOSED_FOR_SUBMISSIONS` outside chain-mapping. 422 `CHAIN_TOPOLOGY_INVALID` for under 4 cells, non-adjacent or duplicate cells. The UI blocks these on the client (HTML:427-428, 455-457). |
| 14 | Undo / Clear (HTML:452-453) | — | — | — | n/a | Local. |
| 15 | Timer Start / Pause (`#tStart`, HTML:537) | — | — | — | missing | The server timer runs from `phaseStartedAt` to `phaseEndsAt`. There is no pause or resume. |
| 16 | Timer Reset (`#tReset`, HTML:538-539) | — | — | — | missing | Restarting a phase is not supported (`transitionTo` only allows the next phase, `game-session.ts:129-134`). |
| 17 | Build/Explain minutes inputs (HTML:540-541) | (only at create) `createGameSession.timerConfig.roundMappingSec/roundAdjudicationSec` | — | — | partial | Cannot change mid-session. Also, `phaseEndsAt` ignores the custom config after create (section 3.3). |
| 18 | **End building** (`#tSkip`, HTML:812-816) and build timer expiry (HTML:531) | `transitionSessionPhase` · POST `/api/v1/sessions/{sessionId}/phase` | Bearer **instructorToken**; `{action:"advance"}` (`round-N:chain-mapping`→`round-N:peer-adjudication`) | `state.currentPhase` → `S.timer.phase="explain"`; `phaseEndsAt - now` → `S.timer.remaining` | yes | The server does not auto-advance on expiry, so a client or job must call this. 409 `INVALID_PHASE_TRANSITION` if out of order. |
| 19 | Explain timer expiry (HTML:532) | `transitionSessionPhase` | `{action:"advance"}` (`peer-adjudication`→`round-summary`) | → `S.timer.phase="done"` | yes | Same note as row 18. |
| 20 | **New round** (`#newRound` / `#nrYes`, HTML:548-557) | `transitionSessionPhase` | `{action:"advance", seed?}` (`round-1:round-summary`→`round-2:chain-mapping`) | `state.activeRoundNumber=2`, new `activeBoard` (spec) | partial | The API has exactly 2 rounds (OAS:508-514); the UI allows unlimited rounds (HTML:545). No reshuffle is implemented. Calling it from `build`/`explain` also needs intermediate advances. |
| 21 | Teams panel: Add team (`#addTeam`, HTML:478) | `joinGameSession` · POST `/api/v1/sessions/join` | `{roomCode, displayName:"Team X"}` | keep `participantToken` per team | yes | One device acting for several teams means the client holds several participant tokens. |
| 22 | Rename team (HTML:473) | — | — | — | missing | `displayName` is fixed at join. |
| 23 | Select active team radio (HTML:470) | — | — | — | n/a | Client-side: choose which participantToken to send in row 13. |
| 24 | **Leaderboard** (`renderLB`, HTML:505-512) | `getRoundStandings` · GET `/api/v1/sessions/{sessionId}/rounds/{roundNumber}/standings` | path params; Bearer (impl) | `standings[]` → rows: `displayName`→Team, `longestValidChainLength`→Longest, `totalValidChainsCount`→Valid | partial | The UI's "To check" (pending count) has no field. Teams with zero approved chains are left out of the API standings (impl only iterates approved chains, `UC/get-round-standings.use-case.ts:29-65`), but the UI shows every team. |
| 25 | **Submitted chains list** (`renderChains`, HTML:482-504) | none (spec: SSE `chain.submitted` from `streamGameSessionEvents`) | — | — | **missing** | There is no GET endpoint to list a round's Concept Chains. A facilitator on another device cannot see submissions. |
| 26 | **Valid / Invalid** buttons per chain (HTML:491-494) | `adjudicateConceptChain` · POST `.../rounds/{roundNumber}/chains/{chainId}/adjudicate` | Bearer **instructorToken**; `{action:"instructor-approve"\|"instructor-reject", feedback (OAS-required), qualityScore?}` | `chain.status` `approved`→`valid`, `rejected`→`invalid` | partial | The UI toggles back to `pending` on a second click (HTML:493-494). The API locks the verdict (`isLocked:true`, UC:71-78), and a second ruling returns 409 `ADJUDICATION_LOCKED_BY_INSTRUCTOR`. The UI has no feedback input. |
| 27 | AI partner: Check chains (`#aiCheck`, HTML:737-764) | `adjudicateConceptChain` with `{action:"ai-evaluate"}` once per pending chain | Bearer (any role in impl) | `chain.verdict` → `c.ai` | partial | The impl is a placeholder (UC:80-89). The UI needs per-link `sound/weak/incorrect` and feedback. OAS `transitionEvaluations[].isSound` is boolean (OAS:1039-1050), so it cannot express "weak". The impl verdict has no per-link data. OAS `ai-evaluate` sets a verdict (not locked), while the UI treats AI output as advisory only (HTML:761). |
| 28 | AI partner: Show example chains (`#aiExamples`, HTML:766-795) | (closest) `getCurriculumPackById` → `adjudicationRubric.calibrationExamples` | — | `path: GridCoord[]` ↔ UI `cells` | missing | Calibration Examples belong to a fixed reference board (GLOSSARY.md:25-27), not to the live board. |
| 29 | AI Stop (`#aiStop`, HTML:729) | — | — | — | n/a | Local AbortController. |
| 30 | Projector view (`#projector`, HTML:561) | — | — | — | n/a | Presentation only. A projector on a separate device would need `getGameSessionState` + SSE. |
| 31 | Reload / recover mid-round (UI uses `claude.hot` snapshot, HTML:836-837) | `getGameSessionState` (+ `streamGameSessionEvents`) | Bearer | `state` → phase, timer, board | partial / missing | No UI equivalent today. Needed for multi-device play. |

---

## 5. Gaps

### 5.1 UI actions with no matching API

1. Board size choice (row 3). Only pack `boardConfig` is available.
2. Custom keyword list as a lightweight session (row 7). The only route is a full Curriculum Pack registration, which needs an instructor token that requires an existing session.
3. Core (starred) keywords that must appear on the board (HTML:340, 597).
4. Learner level and learning objective (HTML:273-274, 392).
5. Saved session templates, edit and delete; share codes (rows 8-9).
6. AI keyword suggestions (row 6) and AI example chains on the live board (row 28).
7. Timer pause, resume and reset; changing minutes mid-session (rows 15-17).
8. Unlimited rounds (row 20). The API has a hard limit of 2.
9. Rename team (row 22).
10. Listing submitted chains for the facilitator (row 25). This is the biggest functional gap. There is no `GET .../rounds/{n}/chains`, and SSE is not implemented.
11. Un-ruling a chain back to pending (row 26).
12. "To check" (pending) count in standings (row 24).
13. Server-dealt board / `activeBoard` (row 10). It is in OAS but not implemented.

### 5.2 API operations with no UI usage in the prototype

- `getGameSessionState`: not needed by the single-device prototype, but required for any real client.
- `streamGameSessionEvents`: OAS only; no UI and no implementation.
- `validateCurriculumPack`, `registerCurriculumPack`: no pack-authoring UI. The builder produces word lists, not packs.
- `adjudicateConceptChain` with `peer-approve` / `peer-challenge`: there is no peer-vote UI. In the UI only the facilitator rules.
- `submitAssessmentAttempt` (pretest/posttest), `submitPerceptionSurvey`, `getSessionAnalytics`: there are no assessment, survey or analytics screens. These phases (`pretest`, `trial-orientation`, `posttest`, `feedback-survey`, `completed`) have no UI.
- Archive/unarchive pack (not in OAS), `/api/health`.

### 5.3 Data-shape mismatches (UI ↔ API DTO)

| Concept | UI shape (source) | API shape (source) | Mismatch |
|---|---|---|---|
| Board | `S.board: string[]` flat, index `i` (HTML:332, 342) | `activeBoard.cells[row][col].card: KeywordCard` (OAS:929-955) | flat index vs 2-D coords; label strings vs card objects with ids |
| Chain cells | `tiles: number[]` (HTML:458) | `path: GridCoord[]` (OAS:1026-1030) | convert with `{row: i / size, col: i % size}` |
| Chain keywords | `words: string[]` labels (HTML:458) | `keywordIds: string[]` (OAS:1124-1127) | the UI has no card ids |
| Link explanations | `links: string[]`, one per transition (HTML:458) | required `narrativeExplanation: string` plus optional `stepRationales: {fromCoord,toCoord,rationale}[]` (OAS:1022-1037); impl `string[]` (`PORT/submit-concept-chain.port.ts:17`) | UI has no overall narrative; OAS and impl disagree on rationale shape |
| Chain owner | `team: number` index into `S.teams` (HTML:458) | `participantId: string` from token (OAS:1103, 1118-1119) | team ≠ participant; one token per team needed |
| Chain status | `"pending"\|"valid"\|"invalid"` (HTML:458, 493-494) | `"pending-review"\|"approved"\|"rejected"` (OAS:1134-1136) | rename mapping; UI can go back to pending, API locks |
| Chain id | `id: number` from `S.nextId++` (HTML:458) | `chainId: string` UUID (`concept-chain.ts:55`) | type |
| AI review | `ai:{links:[{verdict: sound\|weak\|incorrect, feedback}], overall, summary}` (HTML:758-759) | OAS `verdict.transitionEvaluations[{fromKeywordId,toKeywordId,isSound:boolean,commentary}], overallFeedback, qualityScore 1..10` (OAS:1039-1080); impl `{isApproved,isLocked,feedback?,qualityScore?,decidedBy,decidedAt}` (`concept-chain.ts:17-24`) | 3-valued vs boolean; impl has no per-link data; impl score 75 is out of the OAS 1-10 range |
| Phase | `"build"\|"explain"\|"done"` (HTML:519) | `PhaseIdentifier` (OAS:833-846) | see section 1.2 |
| Timer | `{remaining: seconds, running: bool}` client countdown (HTML:333, 528-535) | `phaseStartedAt`, `phaseEndsAt` ISO strings (OAS:985-990) | derive `remaining = phaseEndsAt - now`; no `running` |
| Round | `S.round: 1..∞` (HTML:545) | `activeRoundNumber: 1\|2\|null` (OAS:982-984) | range |
| Standings row | `{name, longest, valid, pending}` (HTML:509) | `{rank, participantId, displayName, longestValidChainLength, totalValidChainsCount, cumulativeRationaleScore, approvedChainIds}` (OAS:1196-1225) | no pending; impl lacks `cumulativeRationaleScore` |
| Topic | `SETS[key] = {name, words}` (HTML:303-319) | `CurriculumPackSummary` / `PublicCurriculumPack` (OAS:737-808) | words ↔ `cards[].displayLabel`; summary has no cards |
| Session config | `{name, level, objective, words, core, size, minChain, build, explain, teams}` (HTML:627-631) | `CreateSessionRequest {packId, mode, adjudicationMode, timerConfig, seed, creatorDisplayName}` (OAS:870-886) | most UI fields have no API field |

### 5.4 Spec-vs-implementation inconsistencies relevant to the overlay

- AGENTS.md / ADR-0002 still describe the `OpenApiHttpApp` single entrypoint; the code uses discrete functions (ADR-0005:27).
- Bearer is required on `getGameSessionState` and `getRoundStandings` in the implementation but not in OAS (section 3.2).
- Register and validate pack require an instructor token in the implementation (and in `.scratch/pack-registration-endpoints/spec.md:33-36`) but not in OAS.
- Archive and unarchive are implemented and in ADR-0006 but missing from OAS (also flagged in `.scratch/api-implementation-gaps/RESEARCH.md:356-358`).
- `.scratch/api-implementation-gaps/RESEARCH.md:48-54` is stale on assessments.

---

## 6. Recommendations for the overlay build (non-binding)

1. Keep a static `API_MAP` object in the HTML, keyed by context id (for example `game.build.submit`, `game.explain.rule`, `builder.start`). Each entry holds `{operationId, method, path, pathParams, auth, requestExample, responseFields, errors, impl: "yes"|"partial"|"specced"|"missing", notes}`, taken from section 4. Do not load the YAML at runtime: the prototype has no bundler and OAS is not enforced server-side anyway.
2. Work out the current context from: `S.timer.phase` (wrap `renderTimer`, HTML:517) plus whether `#setup` is in view (IntersectionObserver) plus the last clicked element, captured by a `document` listener in capture phase (section 1.3). Show the list of operations for that phase, and highlight the one for the element just clicked.
3. Build request examples from live `S` (for example `path` from `S.chain` and `S.size`) so developers see the exact coordinate conversion. Flag fields the UI cannot supply (`keywordIds`, `feedback`, card ids).
4. Show a "drift" badge where OAS and the implementation differ (sections 3.2 and 5.4). Show "missing API" entries for gap rows so the overlay doubles as a backlog view.
5. Keep the overlay state outside `S`, so `claude.hot` snapshots (HTML:836) are unaffected.
