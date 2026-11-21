# 02: Game Sessions, Concept Chains & Adjudication, and Assessments, Survey & Lifecycle (`04`–`06`)

**What to build:** Complete the remaining 11 implemented API endpoints in `docs/api/bruno/` across folders `04`–`06` with auto-chained variables (`sessionId`, `roomCode`, `instructorToken`, `participantId`, `participantToken`, `chainId`) and rich Markdown `docs` blocks:
- **`04-Game-Sessions/` (5 endpoints + `folder.bru`):**
  - `01-create-session.bru` (`POST {{baseUrl}}/api/v1/sessions` — uses `{{accountToken}}`, creates a Classroom Game with `packId: "{{packId}}"`, captures `sessionId`, `roomCode`, `instructorToken`)
  - `02-join-session.bru` (`POST {{baseUrl}}/api/v1/sessions/join` — uses `{{roomCode}}`, captures `participantId`, `participantToken`)
  - `03-get-session-state.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}` — uses `{{instructorToken}}`)
  - `04-transition-phase.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/phase` — uses `{{instructorToken}}`, `{ "action": "advance" }`)
  - `05-extend-phase.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/phase/extend` — uses `{{instructorToken}}`, `{ "seconds": 60 }`)
- **`05-Chains-and-Adjudication/` (4 endpoints + `folder.bru`):**
  - `01-submit-chain.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains` — uses `{{participantToken}}`, submits a valid 4-cell adjacent Concept Chain, captures `chainId`)
  - `02-list-round-chains.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains` — uses `{{instructorToken}}`)
  - `03-adjudicate-chain.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains/{{chainId}}/adjudicate` — uses `{{instructorToken}}` with `instructor-approve`, `qualityScore: 8`, and `feedback`, and documents `peer-approve`/`peer-reject` in `docs`)
  - `04-get-round-standings.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/standings` — uses `{{instructorToken}}`)
- **`06-Assessments-Survey-and-Lifecycle/` (5 endpoints + `folder.bru`, bringing the collection total to all 21 implemented endpoints):**
  - `01-submit-assessment.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/assessments/{{assessmentStage}}` — uses `{{participantToken}}` with all 10 `diabe-teach` MCQ answers; `assessmentStage` defaults to `pretest` in environments and documents `posttest` in `docs`)
  - `02-get-session-analytics.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/analytics` — uses `{{participantToken}}`)
  - `03-submit-survey.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/survey` — uses `{{participantToken}}` with all 9 Likert items and optional comments)
  - `04-leave-session.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/leave` — uses `{{participantToken}}`)
  - `05-end-session.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/end` — uses `{{instructorToken}}`)

See spec: `.scratch/bruno-api-docs/spec.md`.

**Blocked by:** 01 (Bruno collection foundation, environments, Health, Instructor Accounts, and Curriculum Packs)

**Status:** ready-for-agent

- [ ] All 14 `.bru` request files and 3 `folder.bru` files under `04-Game-Sessions`, `05-Chains-and-Adjudication`, and `06-Assessments-Survey-and-Lifecycle` parse cleanly with Bruno's official `.bru` parser
- [ ] Every request file has a non-empty `docs` block explaining its glossary domain concept, required token kind/role, parameters, and `ApiErrorCode`s
- [ ] `01-create-session.bru`, `02-join-session.bru`, and `01-submit-chain.bru` include `script:post-response` blocks that auto-capture `sessionId`, `roomCode`, `instructorToken`, `participantId`, `participantToken`, and `chainId`
- [ ] Typecheck, vitest (`--no-file-parallelism`), lint (≤ 29) and boundaries (≤ 6) are no worse
