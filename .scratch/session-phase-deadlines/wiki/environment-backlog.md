# Environment improvement backlog

Observations to turn into pit-of-success fixes. Each item is dated; mark it done with a commit when actioned.

- **2026-11-17 (as of `b368e85`):** `netlify.toml` force-redirects `/api/v1/packs` to `list-packs` for every HTTP method, and still has a stale `/api/v1/packs/register` redirect. Every function already declares `config.path` + `method`, so the redirects may be redundant or harmful. Verify with `netlify dev`.
- **2026-11-17 (as of `b368e85`):** `submit-perception-survey.port.ts` lives in `src/application/use-cases/` instead of `ports/`. A dependency-cruiser or lint rule could enforce `*.port.ts` placement.
- **2026-11-17:** Once `ClockPort` lands (ticket 01), add a lint rule banning `new Date()` / `Date.now()` in `src/domain` and `src/application`, so time stays injectable.
- **2026-11-17:** The OpenAPI spec omits `POST /packs/{packId}/archive` and `/unarchive`, which are implemented.
- **2026-11-17:** `.scratch/api-implementation-gaps/RESEARCH.md` (2026-11-16) lists assessment and survey as missing; they were committed in `3e37faf`. Remaining gaps as of then: `/stream` (deferred) and `/analytics`.
- **2026-11-17:** Add a pre-commit secret scanner (for example via the `setup-pre-commit` skill). Prompted by the [ADR-0003 credential incident](incident-adr-0003-credentials.md).
- **2026-11-17:** The BDD suite requires a running `netlify dev` (`npm run dev:local`); without one, `npm run test:bdd` fails with "Netlify dev server is not running!" Editing source during a BDD run triggers a reload, and scenarios time out. Consider an in-process harness, or a script that starts the server, runs the suite and stops it.
- **2026-11-17 (as of `8fe821f`):** Baseline lint debt: `npm run lint` reports 132 errors, and `lint:boundaries` reports 6 violations (e.g. `domain-stays-pure: game-session.ts → crypto`). This debt hides new violations; worth a cleanup ticket.
- **2026-11-17 (as of `8fe821f`):** No bounds validation on `timerConfig` values; huge or negative values make `toISOString()` throw in create, join, get and transition.
- **2026-11-17 (as of `b0e1b48`, from the ticket 02 review):** **Lost-update race.** The Mongo game-session repository saves the whole document, so a chain submission racing an instructor's phase transition can overwrite the transition. ADR-0002 calls for document `version` optimistic concurrency; check whether it is enforced. This undermines deadline guarantees under load and is a candidate for its own ticket.
- **2026-11-17 (as of `b0e1b48`):** The `roundNumber` path parameter on chain submission is never checked against the session's active round.
- **2026-11-17 (as of `63e6099`):** Request bodies are not validated against the OpenAPI schema anywhere, so `minimum`/`maximum` in `openapi.yaml` are documentation only; the domain does the real checks. A schema-validation middleware (e.g. a popular npm validator, per ADR-0005) would remove a class of hand-written checks.
- **2026-11-17:** The ticket 03 agent's code review also flagged the ADR-0003 credentials (see the [incident page](incident-adr-0003-credentials.md)); still unresolved.
- **2026-11-17 (as of `4d7b38e`, confirmed by the chief of staff):** **Classroom assessment bug.** `GameSession` stores Assessment Attempts in a `Map<AssessmentStage, AssessmentAttempt>` keyed only by stage, so after the first participant's pretest every other participant gets `ASSESSMENT_ALREADY_SUBMITTED`. The key should be (participant, stage). Survey storage (`_surveyResponse`, singular) likely has the same problem. This breaks Classroom and Study RCT use. Needs a ticket.
- **2026-11-17 (as of `18264ad`, from the ticket 03 review):** The perception survey has the same problem as assessments: it stores one response per session, so only one participant can submit it. Part of the classroom assessment bug above.
- **2026-11-17 (as of `18264ad`):** Peer votes don't stop a chain's author from voting on their own chain, or a participant from voting twice.
- **2026-11-17 (as of `18264ad`):** Domain methods still call `new Date()` themselves (joins, `joinedAt`); the lint-rule idea above would catch this.
- **2026-11-17 (as of `18264ad`):** Join, assessment and survey read the session twice per request (the retrier reloads it). Accepted trade-off.
