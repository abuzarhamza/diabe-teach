# 01: Adjudication lifecycle, Instructor Final Ruling lock, and standings in BDD and handler tests

**What to build:** Exercise the Concept Chain adjudication and Gameplay Round standings journey end-to-end in the classroom BDD suite and close the missing in-process handler test for locked verdicts:
- In a Classroom Game during Peer-Adjudication:
  - A classmate casts a peer approval vote on a submitted Concept Chain (`200`).
  - A learner attempting to issue an Instructor Final Ruling (`instructor-approve`) is refused with `403 FORBIDDEN_ROLE`.
  - The instructor attempting to adjudicate a non-existent Concept Chain id is refused with `404 CHAIN_NOT_FOUND` (proving the three URL path parameters survive `netlify dev`'s 404 `.html` retry).
  - The instructor issues an Instructor Final Ruling (`instructor-approve` with a quality score and feedback), locking the verdict (`200`, `isLocked: true`).
  - Any subsequent peer vote or second Instructor Final Ruling on that locked Concept Chain is refused with `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`.
  - Both the instructor and the learner retrieve Gameplay Round standings (`200`), seeing the approved Concept Chain reflected in the round's rankings.
- In the in-process adjudication handler test suite, add a test verifying that both a peer vote and an instructor ruling on an already-locked Concept Chain return `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`.

See spec: `.scratch/bdd-non-happy-path-coverage/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Handler test: a peer vote and a second instructor ruling on a Concept Chain locked by an Instructor Final Ruling each return `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`
- [x] BDD classroom scenario: peer vote (`200`), learner forbidden from `instructor-approve` (`403 FORBIDDEN_ROLE`), unknown chain id (`404 CHAIN_NOT_FOUND`), Instructor Final Ruling locks the chain (`200`), subsequent vote/ruling on the locked chain returns `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`, and round standings return the updated rankings (`200`)
- [x] Reuses the existing adjudication and standings step definitions where applicable, with no wall-clock sleeps
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (`classroom-session-journey`), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution

- Added an in-process handler test in `tests/functions/adjudicate-chain.test.ts` proving that after an Instructor Final Ruling locks a Concept Chain (`200`, `isLocked: true`), both a subsequent peer vote (`peer-approve`) and a second instructor ruling (`instructor-reject`) return `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR` with `{ code: "ADJUDICATION_LOCKED_BY_INSTRUCTOR", message, details: { chainId } }`.
- Added the zero-sleep BDD scenario `Peer voting, instructor final ruling lock, and round standings` to `tests/integration/features/classroom-session-journey.feature` and supporting steps in `tests/integration/step-definitions/chain-submission.steps.ts` and `tests/integration/step-definitions/assertions.steps.ts`, reusing the existing peer approval, Instructor Final Ruling, and round standings step definitions.
- Verified sequentially: `npm run typecheck` (0 errors), `npx vitest run --no-file-parallelism` (53 files, 963 tests passed), `npm run test:bdd classroom-session-journey` (25 scenarios, 308 steps passed), `npm run lint` (29 problems), and `npm run lint:boundaries` (6 violations).
