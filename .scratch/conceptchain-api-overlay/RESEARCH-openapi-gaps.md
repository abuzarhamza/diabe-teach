# Research: API overlay vs OpenAPI, and API gaps for the ConceptChain UI

Status: research (no code, OpenAPI or HTML changed)
Date: 2026-11-17
Branch inspected: `feat/netlify-v2-local-dev-compatibility` (working tree)

Abbreviations used in citations:
- `OVL` = `claudPoc/ConceptChain (API overlay).html`. Lines 1-837 are the prototype and match `claudPoc/ConceptChain (Copy).html` line for line (only the `<title>` on line 2 differs). Lines 838-1317 are the appended overlay.
- `OAS` = `docs/api/openapi.yaml` (source of truth)
- `NF` = `netlify/functions/`
- `UC` = `src/application/use-cases/`
- `PORT` = `src/application/ports/`
- `GS` = `src/domain/game-session/game-session.ts`, `GST` = `src/domain/game-session/game-session.types.ts`, `CC` = `src/domain/game-session/concept-chain.ts`
- `ERR` = `src/domain/errors/domain-errors.ts`, `MW-ERR` = `src/adapters/inbound/http/middy/domain-error.middleware.ts`, `MW-AUTH` = `src/adapters/inbound/http/middy/auth.middleware.ts`
- `CCSPEC` = `.scratch/concept-chain-api/spec.md`, `PRSPEC` = `.scratch/pack-registration-endpoints/spec.md`, `OVSPEC` = `.scratch/conceptchain-api-overlay/spec.md`, `R1` = `.scratch/conceptchain-api-overlay/RESEARCH.md`

---

# Part A: Does the overlay match `openapi.yaml`?

## A.0 Summary

- The overlay catalog is the `OPS` object (OVL:913-1016). It has 16 entries: all 15 OAS operations plus `archiveCurriculumPack`, which it correctly marks "(not in OpenAPI)" (OVL:1012).
- **operationId, HTTP method and path match OAS for all 15 OAS operations.** No overlay operation claims to be in OAS when it is not.
- **Every OAS line range the overlay cites is still accurate** (table A.1).
- The request-body, response and enum summaries are faithful to OAS, with `$ref`s resolved correctly (A.2).
- **16 corrections are needed** (A.3). Three are factual errors against OAS or the code (A-1, A-2, A-3), one is a wrong flow label (A-13), and the rest are missing information, missing deviation notes or missing entries. Spec-vs-code deviation notes are kept separate in A.4.

## A.1 OAS line citations in the overlay

| Overlay entry (OVL line) | `oas` value cited | What is actually at those OAS lines | Accurate? |
|---|---|---|---|
| listCurriculumPacks (914) | 28-45 | path `/api/v1/packs` at 28, `get` 29-45 | yes |
| getCurriculumPackById (922) | 109-141 | `/api/v1/packs/{packId}` get, 109-141 | yes |
| validateCurriculumPack (932) | 82-107 | `/api/v1/packs/validate` post, 82-107 | yes |
| registerCurriculumPack (938) | 46-80 | `post` under `/api/v1/packs`, 46-80 | yes |
| createGameSession (944) | 143-164, 848-905 | op 143-164; `SessionTimerConfig` 848-868, `CreateSessionRequest` 870-886, `CreateSessionResponse` 888-905 | yes |
| joinGameSession (954) | 166-185, 907-927 | op 166-185; `JoinSessionRequest/Response` 907-927 | yes |
| getGameSessionState (959) | 187-206 | op 187-206 | yes |
| streamGameSessionEvents (964) | 208-223, 1434-1449 | op 208-223; `SseEventEnvelope` 1434-1449 | yes |
| transitionSessionPhase (969) | 225-258, 998-1009 | op 225-258; `TransitionPhaseRequest` 998-1009 | yes |
| submitConceptChain (975) | 260-302, 1022-1037 | op 260-302; `SubmitChainRequest` 1022-1037 | yes |
| adjudicateConceptChain (982) | 304-347, 1149-1194 | op 304-347; `AdjudicateChainRequest` + 3 variants 1149-1194 | yes |
| getRoundStandings (991) | 349-376, 1196-1225 | op 349-376; `PlayerRoundStanding` 1196-1225 | yes |
| submitAssessmentAttempt (998) | 378-423 | op 378-423 | yes |
| submitPerceptionSurvey (1005) | 425-461 | op 425-461 | yes |
| getSessionAnalytics (1009) | 463-482 | op 463-482 | yes |
| archiveCurriculumPack (1012) | "(not in OpenAPI)" | no `/archive` path anywhere in OAS (paths end at 482) | yes |

Several entries cite only the operation lines and not the component schemas they summarise. That is a completeness issue, not an error (correction A-5).

## A.2 Field-by-field check (resolved `$ref`s)

| Operation | Method + path | Path params (OAS) | Security (OAS) | Request body (OAS, resolved) | Success (OAS) | Errors (OAS) | Overlay agrees? |
|---|---|---|---|---|---|---|---|
| listCurriculumPacks | GET `/api/v1/packs` (28-29) | — | none | — | 200 `{packs: CurriculumPackSummary[]}` (34-45, 737-767) | none | yes (OVL:914-921). "None in spec" is correct: there is no top-level `security` key in OAS. |
| registerCurriculumPack | POST `/api/v1/packs` (46-47) | — | none | `CurriculumPackInput` = allOf `PublicCurriculumPack` (50-55, 810-812, 769-808) | 201 `{pack: CurriculumPackSummary}` (57-66) | 400 BadRequest (67-68), 409 (69-74), 422 (75-80) | yes (OVL:938-943). Codes `PACK_ALREADY_EXISTS` / `PACK_VALIDATION_FAILED` are in the enum (OAS:565, 570) but OAS names them only in prose; the overlay's mapping is reasonable. |
| validateCurriculumPack | POST `/api/v1/packs/validate` (82-84) | — | none | `CurriculumPackInput` (87-92) | 200 `{valid, issues: PackValidationIssue{jsonPointer, rule, message}[]}` (94-107, 814-823) | none | yes (OVL:932-937) |
| getCurriculumPackById | GET `/api/v1/packs/{packId}` (109-111) | `packId: string` (118-126) | `[ApiKeyAuth]` OR `[ApiKeyAuth + BearerAuth]` (114-117) | — | 200 `{pack: PublicCurriculumPack}` (128-137) | 401, 404 (138-141) | yes (OVL:922-931) |
| createGameSession | POST `/api/v1/sessions` (143-145) | — | none | `CreateSessionRequest {packId* (default "diabe-teach"), mode*, adjudicationMode*, timerConfig?, seed?, creatorDisplayName?}` (870-886) | 201 `CreateSessionResponse {sessionId, roomCode, instructorToken, participantId?, participantToken?, state}` (155-160, 888-905) | 400, 404 (161-164) | yes (OVL:944-953) |
| joinGameSession | POST `/api/v1/sessions/join` (166-168) | — | none | `{roomCode*, displayName?}` (907-914) | 200 `{sessionId, participantId, participantToken, state}` (178-183, 916-927) | 404 (184-185) | yes (OVL:954-958) |
| getGameSessionState | GET `/api/v1/sessions/{sessionId}` (187-189) | `sessionId` (193, 502-507) | none | — | 200 `{state: PublicSessionState}` (195-204, 957-996) | 404 (205-206) | yes (OVL:959-963; `SESSION_STATE` at OVL:894-900 matches OAS 957-996 incl. optional nullable `activeBoard`) |
| streamGameSessionEvents | GET `/api/v1/sessions/{sessionId}/stream` (208-210) | `sessionId` (214) | none | — | 200 `text/event-stream` `SseEventEnvelope` (216-221, 1434-1449) | 404 (222-223) | yes (OVL:964-968) |
| transitionSessionPhase | POST `/api/v1/sessions/{sessionId}/phase` (225-227) | `sessionId` (233) | `BearerAuth` (230-231) | `{action* advance\|jump (default advance), targetPhase?, seed?}` (998-1009) | 200 `{state}` (241-250) | 401, 403, 404, 409 (251-258) | yes (OVL:969-974) |
| submitConceptChain | POST `.../rounds/{roundNumber}/chains` (260-262) | `sessionId`, `roundNumber: integer enum [1,2]` (268-269, 508-514) | `BearerAuth` (265-266) | `{path*: GridCoord[] minItems 2, narrativeExplanation*: minLength 1, stepRationales?: StepRationale{fromCoord, toCoord, rationale}[]}` (1022-1037, 1011-1020) | 201 `{chain: SubmittedChain}` (277-286, 1097-1147) | 401, 404, 409, 422 (287-302) | **no**: overlay lists 403 as if it were in OAS (A-2) |
| adjudicateConceptChain | POST `.../chains/{chainId}/adjudicate` (304-306) | `sessionId`, `roundNumber`, `chainId: string` (312-318) | `BearerAuth` (309-310) | oneOf by `action`: `{peer-approve\|peer-challenge, comment?}`, `{ai-evaluate}`, `{instructor-approve\|instructor-reject, feedback* minLength 1, qualityScore? 1..10}` (1149-1194) | 200 `{chain: SubmittedChain}` (326-335) | 401, 403, 404, 409 (336-347) | yes (OVL:982-990); 404 code list incomplete (A-6) |
| getRoundStandings | GET `.../rounds/{roundNumber}/standings` (349-351) | `sessionId`, `roundNumber` (355-356) | none | — | 200 `{roundNumber 1\|2, isFinalized, standings: PlayerRoundStanding[]}` (358-374) | 404 (375-376) | yes (OVL:991-997) |
| submitAssessmentAttempt | POST `/api/v1/sessions/{sessionId}/assessments/{stage}` (378-380) | `sessionId`, `stage: enum [pretest, posttest]` (386-392) | `BearerAuth` (383-384) | `{answers*: Record<string, 0\|1\|2\|3\|"I_DONT_KNOW">}` (1234-1241, 1227-1232) | 201 `AssessmentSubmissionResponse` oneOf pretest receipt / posttest result (400-407, 1330-1372) | 401, 404, 409, 422 (408-423) | yes for the spec part (OVL:998-1004); status badge and impl errors wrong (A-3) |
| submitPerceptionSurvey | POST `/api/v1/sessions/{sessionId}/survey` (425-427) | `sessionId` (433) | `BearerAuth` (430-431) | `{responses*: Record<string, 1..5>, comments?}` (1374-1384) | 201 `{participantId, recordedItemCount, submittedAt}` (441-455) | 401, 404, 422 (456-461) | spec part yes (OVL:1005-1008); **status badge and drift are wrong** (A-1) |
| getSessionAnalytics | GET `/api/v1/sessions/{sessionId}/analytics` (463-465) | `sessionId` (471) | `BearerAuth` (468-469) | — | 200 `SessionAnalyticsResponse {role, participantReport?, cohortSummary}` (473-478, 1420-1432) | 401, 404 (479-482) | yes (OVL:1009-1011). "Spec only" is correct: no `NF/*analytics*` exists. |

Shared shapes checked: `ApiErrorResponse {code, message, details?}` (OAS:574-584) = OVL:911. `SubmittedChain` summary (OVL:901-910) = OAS:1097-1147 + `AdjudicationVerdict` 1052-1080 + `TransitionEvaluation` 1039-1050 + `PeerVoteRecord` 1082-1095. `PHASES` (OVL:1022-1023) = `PhaseIdentifier` enum (OAS:833-846). `statusMap` (OVL:1033) uses the OAS status enum (OAS:1134-1136).

## A.3 Corrections the overlay needs

Each item gives the location, the problem with evidence, and the exact replacement text. Items are ordered by severity.

### A-1 `submitPerceptionSurvey` is implemented, not "spec only" (factual error)
- Location: OVL:1005-1008 (`impl:"specced"`, drift `"Spec only: .scratch/perception-survey/SPEC.md. No UI screen."`).
- Evidence: `NF/submit-survey.ts:1-7` routes POST `/api/v1/sessions/:sessionId/survey` to `NF/sessions/submit-survey.ts:27-103`, which runs `UC/submit-perception-survey.use-case.ts:34-106`. R1:150 was correct when written but is now stale.
- Replace with:
  ```js
  submitPerceptionSurvey: { method:"POST", path:"/api/v1/sessions/{sessionId}/survey", impl:"partial", oas:"425-461, 1374-1384",
    auth:"Bearer participantToken (impl rejects instructor tokens and other sessions).", req:`{ responses: Record<itemId, 1..5>, comments? }`,
    res:`201 { participantId, recordedItemCount, submittedAt }`,
    errors:"401 UNAUTHORIZED_TOKEN · 404 SESSION_NOT_FOUND / PACK_NOT_FOUND · 422 (spec) · 403 FORBIDDEN_ROLE (impl) · 409 PHASE_CLOSED_FOR_SUBMISSIONS / SURVEY_ALREADY_SUBMITTED (impl) · 422 INVALID_SURVEY_RESPONSE / SURVEY_COMMENTS_TOO_LONG (impl) · 400 INVALID_REQUEST_BODY (impl, non-standard body)",
    drift:["Only accepted in phase feedback-survey (409 otherwise).",
           "One survey per session, not per participant: a second participant gets 409 SURVEY_ALREADY_SUBMITTED.",
           "Unknown item ids are silently dropped; recordedItemCount counts kept items only.",
           "SURVEY_ALREADY_SUBMITTED, INVALID_SURVEY_RESPONSE and SURVEY_COMMENTS_TOO_LONG are not in the OAS ApiErrorCode enum.",
           "Missing `responses` returns 400 { error, message }, not ApiErrorResponse.", "No UI screen in this prototype."] },
  ```
- Evidence for each fact: role check `UC/submit-perception-survey.use-case.ts:38-45`; phase gate `:56-58`; pack lookup `:61-66`; Likert/comment checks `:69-74, 108-123` (1000-word limit `:22`); item filtering `:77-83, 125-138`; one survey per session `GS:234-245`; 400 body `NF/sessions/submit-survey.ts:65-76`; token/session checks `:53-61`; status mapping `MW-ERR:49-52, 63-69`; codes `ERR:170-201`; enum without them `OAS:555-572`.

### A-2 `submitConceptChain` lists 403 as if it were in OAS (factual error)
- Location: OVL:980 `errors:"401 · 403 FORBIDDEN_ROLE · 404 SESSION_NOT_FOUND · 409 ... · 422 ..."`.
- Evidence: OAS responses are only 201, 401, 404, 409, 422 (OAS:276-302). 403 comes from the implementation: `NF/sessions/submit-chain.ts:51-55` (token for another session) and `UC/submit-concept-chain.use-case.ts:31-38` (non-participant).
- Replace with: `errors:"401 UNAUTHORIZED_TOKEN · 404 SESSION_NOT_FOUND · 409 PHASE_CLOSED_FOR_SUBMISSIONS · 422 CHAIN_TOPOLOGY_INVALID · 403 FORBIDDEN_ROLE (impl)"`.

### A-3 `submitAssessmentAttempt` badge "implemented" hides deviations
- Location: OVL:998-1004 (`impl:"yes"`).
- Evidence: the implementation returns 403 (`NF/sessions/submit-assessment.ts:70-74`; `UC/submit-assessment.use-case.ts:43-50`) and 409 `PHASE_CLOSED_FOR_SUBMISSIONS` (`UC/submit-assessment.use-case.ts:104-117`), and OAS documents neither (OAS:400-423). The 400 bodies are `{error:"INVALID_STAGE"|"INVALID_REQUEST_BODY", message}` (`NF/sessions/submit-assessment.ts:53-89`), not `ApiErrorResponse` (OAS:574-584), and `INVALID_STAGE` is not in `ApiErrorCode` (OAS:555-572).
- Replace `impl:"yes"` with `impl:"partial"`. Replace `errors` with `"401 UNAUTHORIZED_TOKEN · 404 SESSION_NOT_FOUND / PACK_NOT_FOUND · 409 ASSESSMENT_ALREADY_SUBMITTED · 422 ASSESSMENT_INCOMPLETE · 403 FORBIDDEN_ROLE (impl) · 409 PHASE_CLOSED_FOR_SUBMISSIONS (impl) · 400 INVALID_STAGE / INVALID_REQUEST_BODY (impl, body { error, message })"`. Add drift `"Accepted only in the matching phase (pretest / posttest)."`.

### A-4 Path parameters are not shown for any operation
- Location: `OPS` entries have no `pathParams` (OVL:913-1016). `opBlock` and `opCard` never render them (OVL:1220-1258).
- Required by: OVSPEC:41 (user story 10) and the catalog sketch at OVSPEC:83.
- Add a `pathParams` field and render it under the path:
  - `getCurriculumPackById`, `archiveCurriculumPack`: `packId: string` (OAS:118-123)
  - every `/sessions/{sessionId}...` op: `sessionId: string` (OAS:502-507)
  - `submitConceptChain`, `adjudicateConceptChain`, `getRoundStandings`: `roundNumber: integer, enum [1, 2]` (OAS:508-514)
  - `adjudicateConceptChain`: `chainId: string` (OAS:314-318)
  - `submitAssessmentAttempt`: `stage: "pretest" | "posttest"` (OAS:387-392)

### A-5 Add component-schema line ranges where only the operation is cited
The cited ranges are accurate. Extend these `oas` values so each one also points at the schemas it summarises:
- `listCurriculumPacks`: `"28-45, 737-767"`
- `registerCurriculumPack`: `"46-80, 737-767, 810-812"`
- `validateCurriculumPack`: `"82-107, 810-823"`
- `getCurriculumPackById`: `"109-141, 586-648, 650-735, 769-808"`
- `getGameSessionState`: `"187-206, 929-996"`
- `submitAssessmentAttempt`: `"378-423, 1227-1372"`
- `submitPerceptionSurvey`: `"425-461, 1374-1384"`
- `getSessionAnalytics`: `"463-482, 1243-1305, 1386-1432"`

### A-6 `adjudicateConceptChain`: incomplete 404 list and missing deviations
- Location: OVL:989-990.
- The 404 can be `SESSION_NOT_FOUND` or `CHAIN_NOT_FOUND` (`UC/adjudicate-concept-chain.use-case.ts:31-38`; `MW-ERR:36-41, 60-61`). Change to `errors:"401 UNAUTHORIZED_TOKEN · 403 FORBIDDEN_ROLE · 404 SESSION_NOT_FOUND / CHAIN_NOT_FOUND · 409 ADJUDICATION_LOCKED_BY_INSTRUCTOR"`.
- Append these drifts:
  - `"ai-evaluate sets status to approved, so placeholder AI approvals count in getRoundStandings."` (`UC/adjudicate-concept-chain.use-case.ts:80-89`; `CC:132-138`; `UC/get-round-standings.use-case.ts:30-32`)
  - `"ai-evaluate has no role check: any token for the session can trigger it."` (`UC/adjudicate-concept-chain.use-case.ts:80`)
  - `"Peer votes are stored but never change status (no peer-consensus logic)."` (`CC:122-130`)
  - `"No phase gate: rulings and votes are accepted in any phase."` (no phase check in `UC/adjudicate-concept-chain.use-case.ts:25-108`)
  - `"Response adds chainLength and omits sessionId and stepRationales."` (`UC/adjudicate-concept-chain.use-case.ts:93-105` vs OAS:1097-1147)

### A-7 `joinGameSession`: the drift list is empty but the code deviates
- Location: OVL:958 (`drift:[]`).
- Add:
  - `"state.phaseEndsAt uses DEFAULT timers, not the session timerConfig."` (`UC/join-game-session.use-case.ts:45-48, 71-89`)
  - `"state.activeBoard is never returned."` (`:50-61`)
  - `"Joining is allowed in any phase, including completed."` (no phase check, `:23-37`)

### A-8 `transitionSessionPhase`: silent no-ops are not mentioned
- Location: OVL:974.
- Append `"advance from completed, and jump without targetPhase, return 200 with no change."` (`UC/transition-session-phase.use-case.ts:43-51`; `GST:85-96` has no entry for `completed`).
- Append `"phaseEndsAt uses DEFAULT timers."` (`UC/transition-session-phase.use-case.ts:55-58, 76-95`).

### A-9 `submitConceptChain`: missing topology deviations
- Location: OVL:981.
- Append `"No bounds check against board rows/cols; adjacency is hard-coded Chebyshev-8 and ignores pack adjacencyRule."` (`UC/submit-concept-chain.use-case.ts:76-105`; `adjacencyRule` is in OAS:604-607).

### A-10 `createGameSession`: OAS 400 is not implemented
- Location: OVL:953.
- Append `"No request validation: a missing packId throws a TypeError (500), an invalid one gives 404 PACK_NOT_FOUND; mode / adjudicationMode are not checked."` (`NF/sessions/create-session.ts:44-46`; `src/domain/curriculum-pack/pack-id.ts:13-17`; `UC/create-game-session.use-case.ts:30-42`; there is no catch in `src/adapters/inbound/http/lambda-to-v2-wrapper.ts`, which only sets `status` at :69).

### A-11 `validateCurriculumPack`: say which side is authoritative
- Location: OVL:937.
- The implementation's `{valid, errors, warnings}` (`PORT/validate-curriculum-pack.port.ts:22-26`) is what ADR-0006 decided (`docs/adr/0006-curriculum-pack-registration-and-lifecycle.md:57`). OAS `issues` (OAS:99-107) contradicts the ADR, not just the code.
- Replace the drift with `"Impl returns { valid, errors: { path, code, message }[], warnings[] } as ADR-0006 §6 decides; OAS `issues` is out of date with the ADR."`

### A-12 Archive/unarchive entries are incomplete
- Location: OVL:1012-1015.
- `unarchive` appears only as a drift string. Add its own entry (mark the name as synthetic, not an OAS operationId):
  ```js
  unarchiveCurriculumPack: { method:"POST", path:"/api/v1/packs/{packId}/unarchive", impl:"yes", oas:"(not in OpenAPI)",
    auth:"Bearer instructorToken.", res:`200 { packId, isArchived }`,
    errors:"401 UNAUTHORIZED_TOKEN · 403 FORBIDDEN_ROLE · 404 PACK_NOT_FOUND · 409 PACK_NOT_ARCHIVED · 400 MISSING_PACK_ID (body { error: { code, message } })",
    drift:["Implemented (NF/unarchive-pack.ts) and specced in .scratch/pack-registration-endpoints/spec.md, but missing from openapi.yaml."] },
  ```
  Evidence: `NF/unarchive-pack.ts:4-7`; `NF/packs/unarchive-pack.ts:24-50`; `UC/unarchive-curriculum-pack.use-case.ts:28-34`; `MW-ERR:47`; `PRSPEC:16`.
- In `archiveCurriculumPack.errors`, add `401 UNAUTHORIZED_TOKEN` and `400 MISSING_PACK_ID (body { error: { code, message } })` (`NF/packs/archive-pack.ts:30-39`). Note that `PACK_IS_SYSTEM_PACK`, `PACK_ALREADY_ARCHIVED` and `PACK_NOT_ARCHIVED` are not in `ApiErrorCode` (`ERR:115-146` vs OAS:555-572).

### A-13 "New round" flow label is wrong in round 2
- Location: OVL:1048. `flow` is `${apiPhase()} → ${nextPhase(apiPhase())} (repeat until round-2:chain-mapping)`, and `roundNo()` is capped at 2 (OVL:1024).
- In UI round ≥ 2 with timer `done`, this renders `round-2:round-summary → posttest (repeat until round-2:chain-mapping)`, which can never happen.
- Fix: `flow: roundNo() >= 2 ? "No further Gameplay Round in the API (max 2). Next phase is posttest." : \`${apiPhase()} → … → round-2:chain-mapping (advance until reached)\``. Set the action's status to `"missing"` when `S.round >= 2`.

### A-14 `getRoundStandings`: missing deviations
- Location: OVL:997.
- Append `"roundNumber is not validated (parseInt of any value)."` (`NF/sessions/get-standings.ts:54`; OAS:508-514 allows 1|2 only).
- Append `"No dedupe of identical paths (CCSPEC story 28)."` (`UC/get-round-standings.use-case.ts:29-65`; `CCSPEC:50`).

### A-15 Error-body note covers only one case
- Location: OVL:943 (register drift) and OVL:1231 (`"Error body: " + ERR` printed for every op).
- Non-`ApiErrorResponse` bodies also come from:
  - assessment 400s (`NF/sessions/submit-assessment.ts:53-89`)
  - survey 400 (`NF/sessions/submit-survey.ts:65-76`)
  - archive/unarchive 400 (`NF/packs/archive-pack.ts:31-39`, `NF/packs/unarchive-pack.ts:31-39`)
  - any non-DomainError, such as a `JSON.parse` failure, which `MW-ERR:30` leaves unmapped
- Change the errors footer to `"Error body (DomainError via middleware): ApiErrorResponse { code, message, details? }. Some handler-level 400/409/422 bodies differ, see drift."`

### A-16 Summary-level semantic notes (wording only)
- `createGameSession.req` shows `packId (default "diabe-teach")` (OVL:946). OAS marks `packId` as **required** (OAS:872) even though it has a default (OAS:876). Write `packId* (required; default "diabe-teach")`.
- `transitionSessionPhase.req` shows `action ... (default advance)` (OVL:971). `action` is also required (OAS:1000). Write `action*`.

## A.4 OAS operations missing from the overlay, and overlay operations not in OAS

- **OAS operations missing from the overlay: none.** All 15 `operationId`s (OAS:30, 47, 84, 111, 145, 168, 189, 210, 227, 262, 306, 351, 380, 427, 465) have an `OPS` entry.
- **Overlay operations not in OAS:** `archiveCurriculumPack` (OVL:1012), correctly flagged. `unarchiveCurriculumPack` should be added the same way (A-12).
- **Implemented routes in neither:** `GET /api/health` (`NF/health.ts:10-13`). It is fine to leave this out of a UI overlay.
- **In ADR but in neither OAS nor code:** `GET /api/v1/packs/{packId}/versions/{version}` (`docs/adr/0006-curriculum-pack-registration-and-lifecycle.md:33`). The overlay does not need it.

## A.5 Deviation claims in the overlay, checked against code

These are "spec says X / code does Y" notes. They are not cases of the overlay misstating OAS.

| Overlay claim (OVL line) | Verdict | Evidence |
|---|---|---|
| Impl enforces x-api-key when `API_KEY` set (915, 1270) | correct | `MW-AUTH:53-81`; OAS describes it only in prose (OAS:490-492) and declares it only on getCurriculumPackById (OAS:114-117) |
| listCurriculumPacks lists only non-archived packs (921) | correct | `UC/list-curriculum-packs.use-case.ts:18` (`findAllActive`) |
| validate/register require instructor Bearer (933, 939) | correct | `NF/packs/validate-pack.ts:30-34`; `NF/packs/register-pack.ts:25-29` |
| register returns `{packId, version, warnings}`; error body `{error:{code,...}}` (943) | correct | `NF/packs/register-pack.ts:40-75` |
| Chicken-and-egg instructor token (943) | correct | token minted only in `UC/create-game-session.use-case.ts:61-64` |
| createGameSession: no activeBoard, seed ignored, solo starts in pretest, custom timerConfig only in this response (953) | correct | `UC/create-game-session.use-case.ts:37-42, 66-89`; `GS:66`; no `activeBoard` in `src/` |
| getGameSessionState: Bearer required for same session; no activeBoard; DEFAULT timers (960-963) | correct | `NF/sessions/get-session.ts:43-51`; `UC/get-game-session-state.use-case.ts:31-47, 52-71` |
| stream: no Netlify function (968) | correct | no `NF/*stream*` |
| transition: instructor only even in solo; no reshuffle; `jump` = next only; no auto-advance (970, 974) | correct | `UC/transition-session-phase.use-case.ts:30-34`; `GS:135-151`; CCSPEC:104 allows a solo participant |
| submit: reads `keywordIds`; `stepRationales` string[]; min length 4; response shape; roundNumber unchecked (981) | correct | `NF/sessions/submit-chain.ts:57-68`; `PORT/submit-concept-chain.port.ts:17, 20-30`; `UC/submit-concept-chain.use-case.ts:25, 49-71` |
| adjudicate: placeholder AI score 75; impl verdict shape; default action; feedback not enforced; no un-rule (990) | correct | `UC/adjudicate-concept-chain.use-case.ts:40-42, 71-89`; `NF/sessions/adjudicate-chain.ts:64`; `CC:17-24` |
| standings: no `cumulativeRationaleScore`; zero-approved participants omitted (997) | correct | `UC/get-round-standings.use-case.ts:29-87` |
| assessment: one attempt per stage per session (1004) | correct | `GS:198-217` |
| survey "Spec only" (1008) | **wrong**, see A-1 | `NF/sessions/submit-survey.ts` |
| analytics "Spec only" (1011) | correct | no analytics function or use case |
| archive: instructor, 403 PACK_IS_SYSTEM_PACK, 409 PACK_ALREADY_ARCHIVED (1013-1014) | correct | `NF/packs/archive-pack.ts:24-28`; `UC/archive-curriculum-pack.use-case.ts:29-39`; `MW-ERR:46, 56` |

Stale citations in R1 (not the overlay): R1 cites `game-session.ts:62` and `:129-134`. The current lines are `GS:66` (default phase `pretest`) and `GS:135-151` (`transitionTo`).

---

# Part B: API gaps for the UI

## B.0 Method and grounding

For each UI action with no adequate API, this part decides whether it needs a server API (a) and, if so, proposes an OAS change (b). The decision rules come from:

- **Server-authoritative game state.** CCSPEC:13 calls the API "server-authoritative". It says every classroom participant gets "the exact same seeded board grid" (CCSPEC:41), clients recover state from `GET /sessions/{id}` (CCSPEC:35), and SSE updates every screen (CCSPEC:34). Anything that must look the same on several devices (board, phase, timer, chains, rulings, names) needs the server. Anything that only affects one teacher's authoring device can stay on the client.
- **Pack is the unit of content** (ADR-0001, `docs/adr/0001-...md:3`; GLOSSARY:9-11). Packs are immutable and versioned (ADR-0006 §2-3, `docs/adr/0006-...md:25-34`). Only instructors register packs (ADR-0006 §1, :21-23). The minimum pack structure is fixed (ADR-0006 §8, :63-65).
- **Instructor Final Ruling permanently locks** (GLOSSARY:59-61).
- **No user accounts.** Capability Tokens are session-scoped (GLOSSARY:63-65). Permanent accounts are out of scope (CCSPEC:143).
- **Gameplay Round** = freshly shuffled board, then Chain-Mapping, then Peer-Adjudication (GLOSSARY:47-49). The phase machine is forward-only (`GST:85-96`; `GS:135-140`).

Style conventions followed in the proposals:
- camelCase `operationId` in verbNoun form (OAS:30, 145, 262).
- `/api/v1/...` kebab-case paths.
- Reuse of `SessionIdParam`/`RoundNumberParam` (OAS:501-514).
- `{ wrapper: Schema }` success bodies (OAS:61-66, 199-204).
- Shared responses `UnauthorizedError`/`ForbiddenError`/`NotFoundError`/`ConflictError`/`UnprocessableEntityError` (OAS:516-552).
- PascalCase component schemas.
- `oneOf` + `discriminator.propertyName: action` for multi-action bodies (OAS:1149-1161).
- Nullable as `type: [x, "null"]` (OAS:671, 899).

**Proposed new `ApiErrorCode` values** (append to the OAS:555-572 enum):

| Code | HTTP | Used by |
|---|---|---|
| `PARTICIPANT_NOT_FOUND` | 404 | B-6 |
| `TIMER_STATE_CONFLICT` | 409 | B-4 |
| `OPERATION_NOT_ALLOWED_IN_PHASE` | 409 | B-4, B-14 |
| `BOARD_CONFIG_INVALID` | 422 | B-9 |
| `SESSION_CONFIG_NOT_ALLOWED_FOR_MODE` | 422 | B-9, B-12 |

**Housekeeping codes** (already thrown by code, `ERR:115-201`): `PACK_IS_SYSTEM_PACK`, `PACK_ALREADY_ARCHIVED`, `PACK_NOT_ARCHIVED`, `SURVEY_ALREADY_SUBMITTED`, `SURVEY_COMMENTS_TOO_LONG`, `INVALID_SURVEY_RESPONSE` (see B-17).

## B.1 Prioritised overview

| ID | UI action (OVL line) | Needs server? | Proposed OAS change | Priority | ADR / domain conflict? |
|---|---|---|---|---|---|
| B-1 | Submitted chains list for facilitator (482-504) | **Yes** | New `GET .../rounds/{roundNumber}/chains` `listRoundConceptChains`; add `participantDisplayName` to `SubmittedChain` | **P0** | none |
| B-2 | Board grid / New round reshuffle (338-343, 548-557) | **Yes** (already in OAS) | Make `activeBoard` required+nullable; add effective `boardConfig` to `PublicSessionState`; no new path | **P0** | none (OAS:229, 991-994 already decide it) |
| B-3 | Submit chain with per-link text only (454-462) | No (client workaround) / optional | Optional: relax `narrativeExplanation` when `stepRationales` covers every step | P2 | none |
| B-4 | Timer pause / resume / reset / change minutes (537-541) | **Yes** for multi-device | New `POST /sessions/{sessionId}/timer` `controlSessionTimer`; add `timerStatus`, `pausedRemainingSec`, `timerConfig` to `PublicSessionState` | P1 | "Reset to Build" conflicts with the forward-only phase machine; only "restart current phase clock" proposed |
| B-5 | Team roster across devices (465-478) | Yes | Add `participants: ParticipantSummary[]` to `PublicSessionState` | P1 | GLOSSARY has no "Team"; model team = participant |
| B-6 | Rename team (473) | Yes | New `PATCH /sessions/{sessionId}/participants/{participantId}` `updateParticipant` | P1 | none |
| B-7 | Pending ("To check") count in standings (505-512) | Yes (cheap) | Add `pendingChainsCount`, `rejectedChainsCount` to `PlayerRoundStanding`; include all participants | P1 | none |
| B-8 | AI per-link sound/weak/incorrect; advisory AI (737-764) | Yes | Add `rating`, `stepIndex` to `TransitionEvaluation`; add advisory `aiReview` to `SubmittedChain`; optional batch op | P1 (batch P2) | Advisory AI narrows OAS `ai-evaluate` semantics in non-`ai` modes; needs a one-line GLOSSARY clarification |
| B-9 | Board size choice (560; builder 584-587) | Yes (server deals board) | `boardOverrides` in `CreateSessionRequest`, reflected in `state.boardConfig` | P1 | Tension with ADR-0001 (board dims live in pack); disallowed for `study-rct` |
| B-10 | Custom keyword list without a full pack (645-655) | Yes (needs a pack id) | Allow inline `pack: CurriculumPackInput` in `CreateSessionRequest` (alternative to `packId`); add `isListed` to pack input | P1 | **Conflicts with ADR-0006 §1** (instructor token required to register) → needs ADR amendment |
| B-11 | SSE stream / multi-device sync (projector, 561) | Yes | Implement existing op; meanwhile add `stateVersion` + ETag/304 polling; add SSE events | P1 | none |
| B-12 | More than 2 rounds (544-547) | No (recommend UI cap at 2) / optional | Optional `roundCount` in `CreateSessionRequest` + widen round enums/PhaseIdentifier | P2 | **Breaking** change to `PhaseIdentifier` (OAS:833-846) and `RoundNumberParam` (OAS:508-514); not allowed in `study-rct` |
| B-13 | Un-rule chain back to pending (493-494) | No (UI change) | Optional: let the instructor amend their own locked ruling (approve↔reject), never back to pending | P2 | Back-to-pending **conflicts with GLOSSARY:59-61**; amend needs wording clarification |
| B-14 | AI example chains on the live board (766-795) | Optional | New `POST .../rounds/{roundNumber}/example-chains` `generateExampleChains` | P2 | none (distinct from Calibration Example, GLOSSARY:25-27) |
| B-15 | Core (starred) keywords (340, 597) | Yes, if B-2/B-10 adopted | Add `coreCardIds` to `BoardConfig` | P2 | New domain term → GLOSSARY entry needed |
| B-16 | Learner level / learning objective (392, 713) | Yes, if AI moves server-side | Add `learnerLevel`, `learningObjective`, `sessionTitle` to `CreateSessionRequest` + `PublicSessionState` | P2 | none |
| B-17 | (Overlay depends on it) OAS out of sync with code/ADRs | n/a | Add archive/unarchive ops, missing error codes, real security, validate shape | P1 | Aligns OAS with ADR-0006 |
| — | Saved sessions, share codes (658-696) | **No, stay client-only** | none | — | Server templates need an owner; no accounts exist (GLOSSARY:63-65; CCSPEC:143) |
| — | AI keyword suggestions (797-811) | **No, stay client-only** | none | — | Pack authoring UI is out of scope (CCSPEC:146) |
| — | Undo/Clear, tile taps, link inputs, team radio, projector toggle, AI Stop | No | none | — | Local UI state; server re-validates on submit (CCSPEC:42-44) |

**P0 = B-1 and B-2.** Without them, a facilitator device cannot show what learners submitted, and different devices would show different boards. Every other prototype flow can be wired with today's OAS plus client workarounds (one participant token per team; default feedback text for rulings; `narrativeExplanation` = joined link texts; client caps rounds at 2).

---

## B-1 List a round's Concept Chains (facilitator) — P0

(a) **Server.** The facilitator's "Submitted chains" panel (OVL:482-504) has to show chains submitted from other devices. OAS has no list operation: the chains path only has `post` (OAS:260-302). SSE is not implemented (A.5). A list operation is also the recovery path after a reload (CCSPEC:35), and the domain already supports it with `getChainsForRound` (`GS:183-185`).

Visibility rule: participants see only their own chains during `chain-mapping`, so they cannot copy. They see all chains from `peer-adjudication` on, so they can review and vote (CCSPEC:47). Instructors always see all chains.

(b) Proposal. Add a `get` under the existing path:
```yaml
  /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains:
    get:
      operationId: listRoundConceptChains
      tags: [Chains]
      summary: >
        List the Concept Chains submitted in a Gameplay Round (instructor: all chains;
        participant: own chains during chain-mapping, all chains from peer-adjudication onward)
      security:
        - BearerAuth: []
      parameters:
        - $ref: "#/components/parameters/SessionIdParam"
        - $ref: "#/components/parameters/RoundNumberParam"
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [pending-review, approved, rejected]
      responses:
        "200":
          description: Concept Chains for the round, newest first
          content:
            application/json:
              schema:
                type: object
                required: [roundNumber, chains]
                properties:
                  roundNumber:
                    type: integer
                    enum: [1, 2]
                  chains:
                    type: array
                    items:
                      $ref: "#/components/schemas/SubmittedChain"
        "401":
          $ref: "#/components/responses/UnauthorizedError"
        "403":
          $ref: "#/components/responses/ForbiddenError"
        "404":
          $ref: "#/components/responses/NotFoundError"
    post:
      # unchanged
```
Extend `SubmittedChain` (OAS:1097-1147) so the panel can label chains without a second lookup (OVL:489 shows the team name):
```yaml
        participantDisplayName:
          type: [string, "null"]
```
Errors: 401 `UNAUTHORIZED_TOKEN`, 403 `FORBIDDEN_ROLE` (token for another session), 404 `SESSION_NOT_FOUND`. All three are existing codes.

## B-2 Server-dealt board (`activeBoard`) and reshuffle on round entry — P0

(a) **Server.** OAS already decides this. `transitionSessionPhase` "shuffles a fresh board on Round 1 & Round 2 entry" (OAS:229), and `PublicSessionState.activeBoard` exists (OAS:991-994). GLOSSARY:47-49 defines a Gameplay Round as starting with "a freshly shuffled board grid". CCSPEC:40-41 requires the same seeded grid for every participant. Today the prototype deals with `Math.random` (OVL:337-343), and the server deals nothing (A.5). This is mostly an **implementation** gap, plus two contract tightenings:
1. Clients cannot tell "field not implemented" from "no board in this phase". Make `activeBoard` **required and nullable** (null outside `round-N:*` phases).
2. Expose the **effective** board rules on the session. Clients run the topology validator locally (CCSPEC:42), and the rules can differ from the pack once B-9 is adopted.

The board must use Keyword Card ids, so `keywordIds` can be derived on the server from `path`. That removes the impl's need to read `keywordIds` from the body (`NF/sessions/submit-chain.ts:65`).

(b) Proposal. In `PublicSessionState` (OAS:957-996):
```yaml
      required:
        # ...existing...
        - activeBoard
        - boardConfig
      properties:
        activeBoard:
          description: >
            Board dealt for the active Gameplay Round (same seed for all participants);
            null outside round-N:* phases.
          oneOf:
            - $ref: "#/components/schemas/BoardGridView"
            - type: "null"
        boardConfig:
          $ref: "#/components/schemas/BoardConfig"
          description: Effective board rules for this session (pack boardConfig plus any session override, see B-9)
```
There is no new path. The `seed` inputs already exist (`CreateSessionRequest.seed` OAS:883-884, `TransitionPhaseRequest.seed` OAS:1008-1009). New errors: none.

## B-3 `narrativeExplanation` when the UI only has per-link text — P2

(a) **Client workaround first.** The prototype stores one explanation per link (OVL:443-445, 458) and has no overall narrative. OAS requires `narrativeExplanation` (OAS:1024, 1031-1033). GLOSSARY:51-53 only requires "a learner's narrative explanation justifying every transition". Per-step rationales meet that, so the client can join them (as the overlay already does, OVL:1072).

(b) Optional OAS relaxation. In `SubmitChainRequest`, keep `required: [path]` and add:
```yaml
      anyOf:
        - required: [narrativeExplanation]
        - required: [stepRationales]
      description: >
        When narrativeExplanation is omitted, stepRationales must contain exactly path.length - 1
        entries (one per transition); the server stores their join as narrativeExplanation.
```
Errors: 422 `CHAIN_TOPOLOGY_INVALID` is wrong for a missing rationale. Use 400 `INVALID_REQUEST_BODY` (existing).

## B-4 Timer pause / resume / reset / change durations mid-session — P1

(a) **Server**, as soon as more than one screen shows the countdown (projector, learner devices). The countdown is derived from `phaseStartedAt`/`phaseEndsAt` (OAS:985-990), and a client-only pause would desync the devices. Two more server-side problems exist today:
- `phaseEndsAt` ignores the session `timerConfig` after create (`UC/get-game-session-state.use-case.ts:52-71`, `UC/transition-session-phase.use-case.ts:76-95`, `UC/join-game-session.use-case.ts:71-89`), even though the aggregate stores it (`GS:62-65`).
- Clients cannot see the effective durations.

**Domain constraint.** The prototype's Reset sets the phase back to Build (OVL:539). That conflicts with the forward-only phase machine (`GST:85-96`; `GS:135-140`) and with closing submissions at peer-adjudication (CCSPEC:45). Only "restart the current phase's clock" is proposed. Going back to chain-mapping is not.

Auto-advance on expiry stays client-driven (A.5, OVL:1090). A server-side "advance on read when expired" is out of scope here.

(b) Proposal:
```yaml
  /api/v1/sessions/{sessionId}/timer:
    post:
      operationId: controlSessionTimer
      tags: [Sessions]
      summary: Pause, resume or restart the current phase timer, or change phase durations
      security:
        - BearerAuth: []
      parameters:
        - $ref: "#/components/parameters/SessionIdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/TimerControlRequest"
      responses:
        "200":
          description: Timer updated
          content:
            application/json:
              schema:
                type: object
                required: [state]
                properties:
                  state:
                    $ref: "#/components/schemas/PublicSessionState"
        "400":
          $ref: "#/components/responses/BadRequestError"
        "401":
          $ref: "#/components/responses/UnauthorizedError"
        "403":
          $ref: "#/components/responses/ForbiddenError"
        "404":
          $ref: "#/components/responses/NotFoundError"
        "409":
          description: >
            Timer action conflicts with current timer state (TIMER_STATE_CONFLICT, e.g. pause while paused)
            or the phase has no timer (OPERATION_NOT_ALLOWED_IN_PHASE, e.g. completed)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiErrorResponse"

components:
  schemas:
    TimerControlRequest:
      oneOf:
        - $ref: "#/components/schemas/TimerSimpleActionRequest"
        - $ref: "#/components/schemas/TimerUpdateConfigRequest"
      discriminator:
        propertyName: action
        mapping:
          pause: "#/components/schemas/TimerSimpleActionRequest"
          resume: "#/components/schemas/TimerSimpleActionRequest"
          restart-phase: "#/components/schemas/TimerSimpleActionRequest"
          update-config: "#/components/schemas/TimerUpdateConfigRequest"

    TimerSimpleActionRequest:
      type: object
      required: [action]
      properties:
        action:
          type: string
          enum: [pause, resume, restart-phase]

    TimerUpdateConfigRequest:
      type: object
      required: [action, timerConfig]
      properties:
        action:
          type: string
          const: update-config
        timerConfig:
          $ref: "#/components/schemas/SessionTimerConfig"
          description: >
            Partial durations; applies to future phases and, if the current phase's key changes,
            recomputes the current phaseEndsAt from phaseStartedAt (minus paused time).
```
In `PublicSessionState` (OAS:957-996), add the following, and change `phaseEndsAt` to `type: [string, "null"]` (null while paused). This is a minor contract change for strict clients.
```yaml
        timerStatus:
          type: string
          enum: [running, paused, none]
          description: "none for phases without a timer (completed)"
        pausedRemainingSec:
          type: [integer, "null"]
          minimum: 0
        timerConfig:
          $ref: "#/components/schemas/SessionTimerConfig"
          description: Effective durations for this session (defaults merged with overrides)
```
Security: instructor token. Following CCSPEC:104, also allow the participant token when `mode: solo`. Errors: 401, 403 `FORBIDDEN_ROLE`, 404 `SESSION_NOT_FOUND`, 409 `TIMER_STATE_CONFLICT` (new), 409 `OPERATION_NOT_ALLOWED_IN_PHASE` (new), 400 `INVALID_REQUEST_BODY`. Add SSE event `timer.changed` (see B-11).

## B-5 Participant (team) roster in session state — P1

(a) **Server.** The Teams panel (OVL:465-478) and the leaderboard need every participant name. Today OAS exposes only `participantCount` (OAS:995-996), and standings list only participants with approved chains (`UC/get-round-standings.use-case.ts:29-65`). GLOSSARY has no "Team" term (GLOSSARY:1-83). Model each team as one **participant** (one participant token per team; the client holds the tokens, OVL:1098) instead of adding a new concept.

(b) Add to `PublicSessionState` and to the components:
```yaml
        participants:
          type: array
          items:
            $ref: "#/components/schemas/ParticipantSummary"

    ParticipantSummary:
      type: object
      required: [participantId, displayName, joinedAt]
      properties:
        participantId:
          type: string
        displayName:
          type: string
        joinedAt:
          type: string
          format: date-time
```
No new errors. The domain already holds this data (`GST:50-54`; `GS:123-125`).

## B-6 Rename a participant (team) — P1

(a) **Server.** Names appear on other devices: standings use the server `displayName` (`UC/get-round-standings.use-case.ts:45-46, 82`), and B-1 adds `participantDisplayName` to chains. The name is fixed at join (`UC/join-game-session.use-case.ts:33-35`).

(b) Proposal:
```yaml
  /api/v1/sessions/{sessionId}/participants/{participantId}:
    patch:
      operationId: updateParticipant
      tags: [Sessions]
      summary: Rename a participant (instructor for any participant; participant for self)
      security:
        - BearerAuth: []
      parameters:
        - $ref: "#/components/parameters/SessionIdParam"
        - name: participantId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdateParticipantRequest"
      responses:
        "200":
          description: Participant updated
          content:
            application/json:
              schema:
                type: object
                required: [participant]
                properties:
                  participant:
                    $ref: "#/components/schemas/ParticipantSummary"
        "400":
          $ref: "#/components/responses/BadRequestError"
        "401":
          $ref: "#/components/responses/UnauthorizedError"
        "403":
          $ref: "#/components/responses/ForbiddenError"
        "404":
          $ref: "#/components/responses/NotFoundError"

    UpdateParticipantRequest:
      type: object
      required: [displayName]
      properties:
        displayName:
          type: string
          minLength: 1
          maxLength: 40
```
Errors: 400 `INVALID_REQUEST_BODY`, 401 `UNAUTHORIZED_TOKEN`, 403 `FORBIDDEN_ROLE` (participant renaming someone else), 404 `SESSION_NOT_FOUND` / `PARTICIPANT_NOT_FOUND` (new). The 40-character cap matches the prototype's keyword cap (OVL:570). SSE event `participant.updated` (B-11).

## B-7 Pending ("To check") count and full roster in standings — P1

(a) **Server, cheap.** The UI leaderboard shows Longest, Valid and To check for every team (OVL:505-512). The client could count from B-1, but standings are the server's view of the round (CCSPEC:49), and leaving out zero-score participants (`UC/get-round-standings.use-case.ts:29-65`) breaks the UI's every-team table.

(b) Extend `PlayerRoundStanding` (OAS:1196-1225), and document in the op summary (OAS:353) that **every participant** is listed (zero-score participants ranked last):
```yaml
      required:
        # ...existing...
        - pendingChainsCount
        - rejectedChainsCount
      properties:
        pendingChainsCount:
          type: integer
          minimum: 0
        rejectedChainsCount:
          type: integer
          minimum: 0
```
No new errors.

## B-8 AI review: per-link sound / weak / incorrect, advisory AI — P1 (batch P2)

(a) **Server.** The prototype calls Claude from the browser with the viewer's own account (OVL:818, 737-764). Server-side Narrative Adjudication is the decided architecture (outbound `NarrativeAdjudicatorPort`, `docs/adr/0002-...md:3`; per-transition commentary, CCSPEC:46; `ai-evaluate`, OAS:1173-1179). Two contract gaps:
1. `TransitionEvaluation.isSound` is boolean (OAS:1047-1048). The UI needs three levels (OVL:744-746, 758), and its chain rule "valid if no incorrect and at most one weak" (OVL:748) depends on that third level. Each evaluation also has to map to a UI link. The keyword ids work once B-2 exists, but a `stepIndex` is simpler.
2. In the UI the AI is **advisory**: "mark them Valid or Invalid yourself" (OVL:761). In OAS, `ai-evaluate` writes the chain's `verdict`. In the implementation it also changes `status`, which then counts in standings (A-6). In `peer-instructor`/`hybrid` modes an AI opinion should not change `status`.

(b) Extend `TransitionEvaluation` (OAS:1039-1050):
```yaml
      required: [fromKeywordId, toKeywordId, isSound, commentary, stepIndex, rating]
      properties:
        stepIndex:
          type: integer
          minimum: 0
          description: Index of the transition (path[stepIndex] -> path[stepIndex + 1])
        rating:
          type: string
          enum: [sound, weak, incorrect]
        isSound:
          type: boolean
          deprecated: true
          description: Equals rating != "incorrect"
```
Extend `SubmittedChain` (OAS:1097-1147):
```yaml
        aiReview:
          description: >
            Latest advisory AI Narrative Adjudication. In adjudicationMode "ai" the same result is
            also written to verdict/status; in "peer-instructor" and "hybrid" it never changes status.
          oneOf:
            - $ref: "#/components/schemas/AdjudicationVerdict"
            - type: "null"
```
Optional batch for "Check chains" (OVL:739 checks up to 12 pending chains), P2:
```yaml
  /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/ai-review:
    post:
      operationId: requestRoundAiReview
      tags: [Chains]
      summary: Run advisory AI Narrative Adjudication on several pending Concept Chains
      security:
        - BearerAuth: []
      parameters:
        - $ref: "#/components/parameters/SessionIdParam"
        - $ref: "#/components/parameters/RoundNumberParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                chainIds:
                  type: array
                  maxItems: 12
                  items:
                    type: string
                  description: Omit to review all pending-review chains in the round (max 12)
      responses:
        "200":
          description: Chains with updated aiReview
          content:
            application/json:
              schema:
                type: object
                required: [chains]
                properties:
                  chains:
                    type: array
                    items:
                      $ref: "#/components/schemas/SubmittedChain"
        "401":
          $ref: "#/components/responses/UnauthorizedError"
        "403":
          $ref: "#/components/responses/ForbiddenError"
        "404":
          $ref: "#/components/responses/NotFoundError"
```
Errors: existing codes only. 404 `CHAIN_NOT_FOUND` for an unknown id. **Conflict note:** GLOSSARY:55-57 lists the AI specialist as an *authority*. The advisory-only behaviour in non-`ai` modes needs one clarifying sentence there. Operational risk: LLM latency for 12 chains inside one serverless invocation. Check the function timeout before you adopt the batch op.

## B-9 Board size (and min chain length) per session — P1

(a) **Server**, because the server deals the board (B-2). Today size comes only from the pack's `boardConfig` (OAS:586-607). ADR-0001 puts "customizable board dimensions" in the pack (`docs/adr/0001-...md:3`), and packs are immutable (ADR-0006 §2). A new pack version just to play 5×5 instead of 7×7 is heavy. The prototype allows 5..10 (OVL:364) when the word count allows it (OVL:336).

Research integrity (ADR-0006 :71) argues against overrides in `study-rct`. The current impl also ignores the pack's `minChainLength` (`UC/submit-concept-chain.use-case.ts:25`), which is an implementation fix.

(b) In `CreateSessionRequest` (OAS:870-886):
```yaml
        boardOverrides:
          $ref: "#/components/schemas/BoardConfigOverride"

    BoardConfigOverride:
      type: object
      description: >
        Session-level override of the pack boardConfig. rows*cols must not exceed the pack cardCount.
        Rejected for mode "study-rct".
      properties:
        rows:
          type: integer
          minimum: 3
          maximum: 12
        cols:
          type: integer
          minimum: 3
          maximum: 12
        minChainLength:
          type: integer
          minimum: 2
```
The effective config is returned in `state.boardConfig` (B-2). Add a 422 response to `createGameSession`:
```yaml
        "422":
          description: >
            boardOverrides invalid for the pack (BOARD_CONFIG_INVALID) or not allowed for the
            session mode (SESSION_CONFIG_NOT_ALLOWED_FOR_MODE)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiErrorResponse"
```
**Conflict flag:** this is a mild tension with ADR-0001 (board dimensions as pack content). Record it in an ADR, or reject B-9 and require a new Pack Version (GLOSSARY:33-35).

## B-10 Custom keyword list without a pre-registered pack — P1

(a) **Server.** A Game Session needs a `packId` (OAS:872-876), and the server needs the cards to deal the board (B-2). The builder only gathers plain strings (OVL:627-631). Two blockers:
1. **Pack shape.** ADR-0006 §8 requires domains, cards and a rubric (`docs/adr/0006-...md:63-65`). This can be met on the client with a deterministic mapping, so no new pack shape is needed:

   | Pack field | Value built on the client |
   |---|---|
   | `id` | `custom-<slug(name)>-<shortid>` |
   | `version` | `"1.0.0"` |
   | `description` | learning objective |
   | `domains` | `[{id:"general", label:name, description:objective}]` |
   | `cards[i]` | `{id: slug(word), verbatimLabel: word, displayLabel: word, aliases: [], domainId:"general", summary: ""}` |
   | `adjudicationRubric` | `{evaluatorPersona: "Educator for <level>", subjectDomain: name, chainContinuityCriteria: ["Each link is factually accurate and explains the connection"], calibrationExamples: []}` |

   `calibrationExamples` has no `minItems` (OAS:693-696). `chainContinuityCriteria` needs ≥1 item (OAS:681-685).
2. **Auth bootstrap.** Registration needs an instructor token (ADR-0006 §1; `NF/packs/register-pack.ts:25-29`), and the only way to get one is to create a session (`UC/create-game-session.use-case.ts:61-64`). ADR-0006 :84 admits this. A no-change workaround exists: create a throwaway session on `diabe-teach`, register, then create the real session. It leaves orphan sessions.

Side effects to note:
- Every ad-hoc pack would appear in `listCurriculumPacks`, which is the "pack pollution" ADR-0006 :23 wants to avoid.
- Single-domain packs make the Chain Diversity Index trivial (GLOSSARY:77-79).
- Editing a saved list requires a new version or id, because packs are immutable (ADR-0006 §2).

(b) Proposal: register-and-create in one call.

In `CreateSessionRequest`, change `required: [packId, mode, adjudicationMode]` (OAS:872) to:
```yaml
      required: [mode, adjudicationMode]
      oneOf:
        - required: [packId]
        - required: [pack]
      properties:
        pack:
          $ref: "#/components/schemas/CurriculumPackInput"
          description: >
            Inline Curriculum Pack registered atomically with the session; createdBy = the new
            sessionId. Not allowed together with packId.
```
`CreateSessionResponse` (OAS:888-905) adds `pack: CurriculumPackSummary` (present when an inline pack was registered).

Add to `PublicCurriculumPack`/`CurriculumPackInput` (OAS:769-812) and to `CurriculumPackSummary`:
```yaml
        isListed:
          type: boolean
          default: true
          description: When false the pack is omitted from listCurriculumPacks but reachable by id
```
Add `createGameSession` responses: 409 `PACK_ALREADY_EXISTS` and 422 `PACK_VALIDATION_FAILED` (existing codes).

**Conflict flag: this contradicts ADR-0006 §1** ("Only users holding an instructor Capability Token can register"). Amend the ADR to say "or atomically while creating the session that issues the instructor token". `isListed` needs an ADR-0006 §4 note: it is a listing flag, separate from Pack Archive (GLOSSARY:37-39).

## B-11 Real-time sync: SSE and polling — P1

(a) **Server.** OAS has `streamGameSessionEvents` (OAS:208-223), and CCSPEC:34, 59 require it, but no function exists (A.5). Netlify support for long-lived streams is a known risk (`.scratch/api-implementation-gaps/RESEARCH.md:75`). Until SSE ships, clients can poll cheaply if the state carries a version and the server supports conditional GETs. The prototype needs this for a projector on another device (OVL:1053) and for B-1.

(b) Proposal:
- `PublicSessionState` adds
  ```yaml
        stateVersion:
          type: integer
          minimum: 0
          description: Monotonic version incremented on every session mutation
  ```
- `getGameSessionState`, `listRoundConceptChains` and `getRoundStandings` accept `If-None-Match` and return `ETag: "<stateVersion>"`. Add:
  ```yaml
        "304":
          description: Not modified since the supplied ETag
  ```
- `SseEventEnvelope` (OAS:1434-1449): add `id: string` (= stateVersion, used for `Last-Event-ID`). Extend the `event` enum with `board.dealt`, `timer.changed`, `participant.updated`.
- No new error codes.

## B-12 More than two Gameplay Rounds — P2 (recommend: client-only cap)

(a) **Recommend no server change. Cap the UI at 2 rounds.** OAS hard-codes two rounds:
- the `PhaseIdentifier` enum (OAS:833-846)
- `RoundNumberParam` (OAS:508-514)
- `activeRoundNumber` (OAS:982-984)
- standings `roundNumber` (OAS:366-368) and `SubmittedChain.roundNumber` (OAS:1115-1117)
- the domain transitions (`GST:85-96`) and round typing `1 | 2` (`GS:44`; `CC:29`)

The 2-round protocol comes from the RCT design (CCSPEC:40, 51), which research integrity needs (ADR-0006 :71). Unlimited rounds in the prototype (OVL:545) is a single-device convenience.

(b) If classroom use needs it later:
- `CreateSessionRequest.roundCount: integer, minimum 1, maximum 10, default 2`, rejected unless 2 for `study-rct` (422 `SESSION_CONFIG_NOT_ALLOWED_FOR_MODE`).
- `PhaseIdentifier` becomes `anyOf` the fixed enum `[pretest, trial-orientation, posttest, feedback-survey, completed]` plus `pattern: "^round-[1-9][0-9]?:(chain-mapping|peer-adjudication|round-summary)$"`.
- Every `enum: [1, 2]` round field becomes `minimum: 1`.
- `PublicSessionState.roundCount` is added.

**Conflict flag: breaking contract change** to generated clients and the domain's `1 | 2` types. Needs an ADR.

## B-13 Un-ruling a chain back to pending — P2 (recommend: UI change)

(a) **No API.** An Instructor Final Ruling "permanently locks" the verdict (GLOSSARY:59-61). OAS returns 409 on a locked chain (OAS:342-347), and so does the code (`UC/adjudicate-concept-chain.use-case.ts:40-42`). The UI's toggle back to pending (OVL:493-494) should become a local "draft mark" that the facilitator confirms, or a confirm step before the API call. The UI also lacks the `feedback` the API requires (OAS:1183-1190). Send a default text, or add a feedback input.

(b) Optional, if facilitators must fix mis-clicks: let an `instructor-approve`/`instructor-reject` on a chain already locked **by an instructor** overwrite the verdict. It stays locked and is never returned to `pending-review`. Peers and AI still get 409. Change the 409 description at OAS:343 to "...locked by an Instructor Final Ruling (peer votes and AI re-evaluation only)". There is no schema change.

**Conflict flag:** "permanently" in GLOSSARY:60 has to be reworded to "against peer votes and automated re-evaluation". Returning to `pending-review` is **not** proposed because it contradicts the glossary.

## B-14 AI example chains on the live board — P2

(a) **Optional server.** This is a debrief aid that the UI holds back during building (OVL:768). It is not a Calibration Example: those are fixed boards inside the pack (GLOSSARY:25-27; OAS:686-696). It does not change game state, so it can stay client-side, as the prototype has it. A server version adds two things: the server owns the board after B-2, and the server can run its topology validator on the AI output (the UI filters invalid chains itself, OVL:778-787).

(b) If adopted:
```yaml
  /api/v1/sessions/{sessionId}/rounds/{roundNumber}/example-chains:
    post:
      operationId: generateExampleChains
      tags: [Chains]
      summary: Generate topologically valid example Concept Chains for the round's board (not during chain-mapping)
      security:
        - BearerAuth: []
      parameters:
        - $ref: "#/components/parameters/SessionIdParam"
        - $ref: "#/components/parameters/RoundNumberParam"
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                count:
                  type: integer
                  minimum: 1
                  maximum: 5
                  default: 3
      responses:
        "200":
          description: Example chains on the active board
          content:
            application/json:
              schema:
                type: object
                required: [examples]
                properties:
                  examples:
                    type: array
                    items:
                      $ref: "#/components/schemas/ExampleChain"
        "401":
          $ref: "#/components/responses/UnauthorizedError"
        "403":
          $ref: "#/components/responses/ForbiddenError"
        "404":
          $ref: "#/components/responses/NotFoundError"
        "409":
          description: Not available during chain-mapping (OPERATION_NOT_ALLOWED_IN_PHASE)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiErrorResponse"

    ExampleChain:
      type: object
      required: [path, keywordIds, stepRationales]
      properties:
        path:
          type: array
          items:
            $ref: "#/components/schemas/GridCoord"
        keywordIds:
          type: array
          items:
            type: string
        stepRationales:
          type: array
          items:
            $ref: "#/components/schemas/StepRationale"
```
Security: instructor token. Errors: 403 `FORBIDDEN_ROLE`, 409 `OPERATION_NOT_ALLOWED_IN_PHASE` (new).

## B-15 Core (starred) keywords — P2

(a) **Server, if B-2 and B-10 are adopted.** Core words always go on the board (OVL:340, 590), so the server's deal has to know them. They belong with the deal rules in the pack. Packs are immutable, so they are set at (inline) registration. GLOSSARY has no such term.

(b) In `BoardConfig` (OAS:586-607):
```yaml
        coreCardIds:
          type: array
          items:
            type: string
          description: Keyword Card ids dealt onto every board; length must not exceed rows*cols
```
Validation adds a pack rule. A failure surfaces as 422 `PACK_VALIDATION_FAILED` (existing). **Conflict flag:** add a GLOSSARY term, for example "**Core Keyword Card**: a Keyword Card guaranteed a cell on every dealt board".

## B-16 Learner level, learning objective, session title — P2

(a) **Server, once AI adjudication is server-side.** The prototype sends these to the AI (`aiContext`, OVL:713) and shows them over the board (OVL:392). They describe a **cohort** rather than the content, so they belong on the session and not the immutable pack (ADR-0006 §2). One pack can serve Year-2 and Year-4 classes.

(b) Add to `CreateSessionRequest` (OAS:870-886) and `PublicSessionState` (OAS:957-996):
```yaml
        sessionTitle:
          type: [string, "null"]
          maxLength: 120
        learnerLevel:
          type: [string, "null"]
          maxLength: 80
        learningObjective:
          type: [string, "null"]
          maxLength: 500
```
No new errors (400 `INVALID_REQUEST_BODY`). No conflict.

## B-17 OAS housekeeping the overlay depends on — P1

These are not UI gaps, but until OAS matches the code and the ADRs, the overlay has to keep carrying drift notes:
1. **Add the archive/unarchive operations** (ADR-0006 §4, `docs/adr/0006-...md:36-41`; code `NF/archive-pack.ts:4-7`, `NF/unarchive-pack.ts:4-7`):
   - `POST /api/v1/packs/{packId}/archive`, operationId `archiveCurriculumPack`, BearerAuth. 200 `{packId, isArchived, archivedAt}`. Errors 401, 403 (`FORBIDDEN_ROLE`, `PACK_IS_SYSTEM_PACK`), 404, 409 `PACK_ALREADY_ARCHIVED`.
   - `POST /api/v1/packs/{packId}/unarchive`, operationId `unarchiveCurriculumPack`, BearerAuth. 200 `{packId, isArchived}`. Errors 401, 403, 404, 409 `PACK_NOT_ARCHIVED`.
2. **Extend `ApiErrorCode`** with `PACK_IS_SYSTEM_PACK`, `PACK_ALREADY_ARCHIVED`, `PACK_NOT_ARCHIVED`, `SURVEY_ALREADY_SUBMITTED`, `SURVEY_COMMENTS_TOO_LONG`, `INVALID_SURVEY_RESPONSE` (`ERR:115-201`). Add 403/409 to `submitAssessmentAttempt` and 403/409 to `submitPerceptionSurvey` (A-1, A-3).
3. **Declare the real security:**
   - top-level `security: [{ApiKeyAuth: []}]` (`MW-AUTH:53-81`)
   - `BearerAuth` on `getGameSessionState` and `getRoundStandings` (`NF/sessions/get-session.ts:43-51`, `NF/sessions/get-standings.ts:44-52`)
   - `BearerAuth` on `registerCurriculumPack`/`validateCurriculumPack` (ADR-0006 §1; PRSPEC:33-34)
4. **Validate response:** replace `issues` with `{valid, errors, warnings}` per ADR-0006 :57 (A-11).

## B.2 Items that stay client-only (reasoning)

- **Saved sessions** (OVL:658-683): a server-side list needs an owner key. The platform has no accounts (GLOSSARY:63-65 session-scoped tokens; CCSPEC:143 accounts out of scope). Once B-10 exists, a saved session is just `packId@version` plus session settings, so `localStorage` is enough.
- **Share codes** (OVL:684-696): a serialised config, not a live session. It is a different concept from the `roomCode` used by `joinGameSession` (OAS:907-914). After B-10, the code can carry `packId@version` instead of the full word list.
- **AI keyword suggestions** (OVL:797-811): pack-authoring assistance, and a pack-authoring UI is out of scope for the API (CCSPEC:146). It does not change game state.
- **Tile taps, undo/clear, link inputs** (OVL:422-453): local chain building. The server re-validates topology on submit (CCSPEC:42-44; OAS:297-302).
- **Active team radio** (OVL:470): chooses which participant token the client sends (B-5).
- **Projector toggle, AI Stop** (OVL:561, 729): presentation and local request cancellation.

## B.3 ADR / domain conflicts raised by the proposals

| Proposal | Conflicts with | Resolution needed |
|---|---|---|
| B-10 inline pack at session create | ADR-0006 §1 (instructor token required to register) and :23 (pack pollution) | ADR-0006 amendment; `isListed` flag |
| B-9 board overrides | ADR-0001 (board dims are pack content); research integrity (ADR-0006 :71) | ADR note; reject for `study-rct` |
| B-12 >2 rounds | OAS enums (833-846, 508-514); domain `1 \| 2` (`GS:44`, `CC:29`); RCT protocol (CCSPEC:40) | New ADR; breaking change |
| B-13 amend/un-rule | GLOSSARY:59-61 "permanently locks" | Glossary rewording (amend only); no return to pending |
| B-4 reset timer to Build | Forward-only phase machine (`GST:85-96`, `GS:135-140`); CCSPEC:45 | Only "restart current phase clock" proposed |
| B-8 advisory `aiReview` | OAS `ai-evaluate` writes `verdict` (OAS:1173-1179); GLOSSARY:55-57 names AI as an authority | Clarify per `adjudicationMode` in GLOSSARY/ADR |
| B-15 core keywords | Not in GLOSSARY | Add glossary term |
| B-5/B-6 teams | GLOSSARY has no "Team" | Model team = participant; no new term |

## B.4 Unrelated finding (security)

`docs/adr/0003-platform-database-naming-concept-chain.md:5-7` has what looks like a username, a password and a MongoDB Atlas connection-string host, appended after the ADR text. It is a modified tracked file in the working tree (per `git status`). Remove it before committing, and rotate the credential if it has ever been pushed.
