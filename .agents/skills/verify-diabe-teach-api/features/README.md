# diabe-teach API verification map

This directory is the source we maintain for verifying the user-facing behaviour of the diabe-teach HTTP API. Read this index before you drive the API, then follow the matching feature file as the recipe. Commands use `vapi` as shorthand for `node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts`, run from the repo root.

## Baseline preconditions

- `scripts/launch.sh` printed `DEV READY http://localhost:8888`, so this run started the server with `npm run dev:local` (in-memory MongoDB, API key enforced).
- `vapi doctor` printed `DOCTOR HEALTHY`.
- The database is empty except for the seeded System Pack `diabe-teach` (pack id `diabe-teach`). It has no accounts, no sessions and no custom packs. A new launch always gives a new, empty database.
- No other agent is running BDD, Bruno or vitest at the same time, and nobody edits source while the server runs.

## Driving conventions

- Every recipe starts from the baseline unless its preconditions say otherwise. Recipes that need a teacher create one with a unique email, so recipes can run one after another on the same instance.
- Every write is one `vapi req <feature-id> <label> …` call. Use the feature file's id (for example `teacher-accounts`) as `<feature>`, so its evidence lands in `.verification/<run-id>/<feature-id>/`.
- Pass tokens with `--auth <var>` after saving them with `--save`. Never paste a token or the API key onto a command line.
- Treat every command as literal: keep paths, JSON field names and error codes as written.
- Run the bullets of a recipe in order. Later bullets depend on vars saved by earlier ones.

## Proof and skip reporting

- Pair each write with a read that shows the new state: a `GET`, or the same write repeated to get its conflict code.
- Check error paths with `--expect-code <ApiErrorCode>`, not only with the status.
- Name the feature id and the entry point (route) for every evidence file. `vapi` does this for you through the folder and file name.
- If a step fails, report the command, the status and code it got, and its evidence file. Don't change the recipe until it passes. If a precondition is missing, write it down under the feature's `Gotchas`.
- Don't report a sub-feature as verified because a different route covered it.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph that describes the behaviour a user sees. It then has exactly four H2 sections, in this order:

1. `Sub-features` lists short ids, with one line for each behaviour.
2. `How to get to it (user POV)` lists every route a client would call.
3. `Driving it with vapi` starts with `Preconditions:`, then has labelled bullets that each pair a user action with an exact command and the result you should see.
4. `Gotchas` lists traps that can waste a verification run or make it invalid.

## Features

Proof status at `37e2b89`: the whole `teacher-accounts` recipe has been executed and passes. The other four recipes were written from the Bruno collection, the handlers and one probe of the response shape, but have not been executed end to end. The first run of each one is also its check: fix the recipe where the API answers differently, and report a real defect as a finding.

- [Teacher accounts](./teacher-accounts.md) (`teacher-accounts`) covers sign-up, sign-in, `GET /accounts/me`, email normalisation, the credential errors, lockout, and the token kind each route accepts.
- [Curriculum packs](./curriculum-packs.md) (`curriculum-packs`) covers listing and fetching packs, answer-key redaction, and validating, registering, archiving and unarchiving a pack.
- [Classroom session lifecycle](./session-lifecycle.md) (`session-lifecycle`) covers creating a session, joining it with a room code, reading its state, advancing or extending a phase, leaving and ending.
- [Concept chains and adjudication](./concept-chains.md) (`concept-chains`) covers submitting a chain, the chain-list visibility rule, peer votes, the Instructor Final Ruling and round standings.
- [Assessments, survey and analytics](./assessments-survey-analytics.md) (`assessments-survey-analytics`) covers the pre-test and post-test, the perception survey, and analytics scoped by role.
