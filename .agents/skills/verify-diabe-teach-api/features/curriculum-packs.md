# Curriculum packs

Anyone with the API key can browse the shared library of Curriculum Packs and open one, but MCQ answer keys stay hidden unless the caller is a session instructor. A signed-in teacher can validate a draft pack, register it so it appears in the library under their author handle, and archive or unarchive it. The `diabe-teach` System Pack can never be archived.

## Sub-features

- `packs-list` lists the latest Pack Version of each unarchived pack, and lists archived ones too with `includeArchived=true`.
- `packs-get` returns one full pack: board config, domains, cards, rubric, assessment instrument and survey.
- `packs-answer-key` returns `correctOptionIndex` and `explanation` as `null` without an instructor Capability Token, and with their values when one is supplied.
- `packs-validate` checks a draft pack and reports errors and warnings without storing it.
- `packs-register` stores a new pack (`201`) and lists it.
- `packs-archive` hides a pack from the default list. Archiving it a second time gives `409`.
- `packs-unarchive` restores it. Unarchiving a pack that is not archived gives `409`.
- `packs-system-protected` refuses to archive `diabe-teach`.
- `packs-auth` refuses to validate, register or archive without an Account Token.

## How to get to it (user POV)

- `GET /api/v1/packs` and `GET /api/v1/packs?includeArchived=true` (API key only).
- `GET /api/v1/packs/:packId` (API key only, or with an instructor Capability Token to see the answer key).
- `POST /api/v1/packs/validate` with the Account Token and a pack body.
- `POST /api/v1/packs` with the Account Token and a pack body.
- `POST /api/v1/packs/:packId/archive` and `POST /api/v1/packs/:packId/unarchive` with the Account Token.
- Bruno: `docs/api/bruno/03-Curriculum-Packs/`. Its validate and register requests carry the 3x3 `endocrine-intro` pack that the bullets reuse through `--bru-body`.

## Driving it with vapi

Preconditions:

- Baseline from the [README](./README.md).
- No pack `endocrine-intro` is stored yet. Every new launch meets this.

- **Teacher signs up.** Run `vapi req curriculum-packs sign-up POST /api/v1/accounts/sign-up --json '{"email":"packs.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`, then `vapi set customPackId=endocrine-intro`.
- **List the library.** Run `vapi req curriculum-packs list GET /api/v1/packs --expect 200`. `packs[]` contains an item with `id: "diabe-teach"`, a 7x7 `boardConfig`, `cardCount: 49` and `isArchived: false`.
- **Open the System Pack as a learner.** Run `vapi req curriculum-packs get-redacted GET /api/v1/packs/diabe-teach --expect 200 --expect-field pack.id=diabe-teach`. In the evidence, every assessment question has `correctOptionIndex: null` and `explanation: null`.
- **Open it as an instructor.** Run `vapi req curriculum-packs instructor-session POST /api/v1/sessions --json '{"packId":"diabe-teach","mode":"solo","adjudicationMode":"peer-instructor"}' --expect 201 --save instructorToken=instructorToken`, then `vapi req curriculum-packs get-unredacted GET /api/v1/packs/diabe-teach --auth instructorToken --expect 200`. This time the questions have non-null `correctOptionIndex` values.
- **Unknown pack.** Run `vapi req curriculum-packs get-unknown GET /api/v1/packs/no-such-pack --expect 404 --expect-code PACK_NOT_FOUND`.
- **Validate a draft.** Run `vapi req curriculum-packs validate POST /api/v1/packs/validate --auth accountToken --bru-body docs/api/bruno/03-Curriculum-Packs/03-validate-pack.bru --expect 200`. The result reports the pack as valid with no errors. Then run `vapi req curriculum-packs list-after-validate GET /api/v1/packs --expect 200`: `endocrine-intro` is not listed, because validation stores nothing.
- **Validate without signing in.** Run `vapi req curriculum-packs validate-no-token POST /api/v1/packs/validate --bru-body docs/api/bruno/03-Curriculum-Packs/03-validate-pack.bru --expect 401 --expect-code UNAUTHORIZED_TOKEN`.
- **Register.** Run `vapi req curriculum-packs register POST /api/v1/packs --auth accountToken --bru-body docs/api/bruno/03-Curriculum-Packs/04-register-pack.bru --expect 201`. Then run `vapi req curriculum-packs list-after-register GET /api/v1/packs --expect 200`: an item with `id: "endocrine-intro"` is listed with `version: "1.0.0"`, `cardCount: 9` and the teacher's non-null `authorHandle` (`diabe-teach` has `authorHandle: null`).
- **Archive.** Run `vapi req curriculum-packs archive POST /api/v1/packs/{{customPackId}}/archive --auth accountToken --expect 200 --expect-field isArchived=true`. Then `vapi req curriculum-packs list-after-archive GET /api/v1/packs --expect 200` no longer lists `endocrine-intro`, and `vapi req curriculum-packs list-archived 'GET' '/api/v1/packs?includeArchived=true' --expect 200` lists it with `isArchived: true`.
- **Archive twice.** Run `vapi req curriculum-packs archive-again POST /api/v1/packs/{{customPackId}}/archive --auth accountToken --expect 409 --expect-code PACK_ALREADY_ARCHIVED`.
- **Unarchive.** Run `vapi req curriculum-packs unarchive POST /api/v1/packs/{{customPackId}}/unarchive --auth accountToken --expect 200 --expect-field isArchived=false`, then `vapi req curriculum-packs list-after-unarchive GET /api/v1/packs --expect 200`, which lists `endocrine-intro` again. Unarchiving a second time gives `--expect 409 --expect-code PACK_NOT_ARCHIVED`.
- **System Pack is protected.** Run `vapi req curriculum-packs archive-system-pack POST /api/v1/packs/diabe-teach/archive --auth accountToken --expect 403 --expect-code PACK_IS_SYSTEM_PACK`.
- **Archive unknown pack.** Run `vapi req curriculum-packs archive-unknown POST /api/v1/packs/no-such-pack/archive --auth accountToken --expect 404 --expect-code PACK_NOT_FOUND`.

## Gotchas

- List items identify a pack by `id`, not by `packId` as the Bruno docs say, and have no `isSystemPack` field (as of `37e2b89`). Write assertions against `id`.
- Archive and unarchive take no body: don't pass `--json`. The other POSTs in this map do take a JSON body.
- Two known OpenAPI drifts: `validateCurriculumPack` is documented as `issues[]` with `jsonPointer` and `rule`, but returns `errors`/`warnings` with `path` and `code`. Also, register, archive and unarchive once returned `{error:{code}}` instead of `{code,message}`. If `--expect-code` fails because `code` is nested, record that as a finding.
- 403 and 404 answers used to reach the client as 401 or 400 "missing path parameters", because netlify dev retries them as `<path>.html`. The `@route-params` BDD scenarios guard this. If it comes back, that is a regression.
- `register` refuses an `id` that already exists. Each launch starts empty, but on a reused instance pick a new `customPackId` and edit nothing else.
- A Game Session pins the Pack Version it started on. Archiving a pack doesn't break sessions that already use it.
