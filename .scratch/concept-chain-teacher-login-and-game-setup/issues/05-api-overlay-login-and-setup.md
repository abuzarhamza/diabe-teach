# 05: API overlay on Teacher login and Game setup

**What to build:** Both new pages get the API overlay toggle, tags, cards and legend from the existing overlay. Teacher login's form is tagged as a gap ("no teacher sign-in endpoint"). On Game setup: the pack list maps to `listCurriculumPacks`, the keyword preview to `getCurriculumPackById`, the create-pack form to `validateCurriculumPack` then `registerCurriculumPack` (noting a real pack needs Keyword Card ids, Semantic Domains and a rubric, and that register needs an instructor token only `createGameSession` issues), Shuffle to the `seed` field (status partial: backend ignores `seed`), shortest chain and board size flagged as not enforced by the API, and learner level/objective noted as having no API field (closest: pack `description`). "Start game" is step **A** `createGameSession`, with a live sample built from the form: `packId`, `mode: "classroom"`, `adjudicationMode: "peer-instructor"`, `creatorDisplayName`, `timerConfig` (seconds, `null` for teacher-paced) and `seed`. The legend's screens include the new pages. See `../spec.md` → Solution 5, user stories 36–42, 50–51, Testing Decisions.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Toggle, outlines, tags and legend work on both new pages and persist across login → setup → teacher screen
- [ ] Every element listed above is tagged with the right step/operation/gap and read/write style
- [ ] "Start game" card shows a live request matching the form, including `timerConfig` and `seed`
- [ ] Drift test covers both pages' `data-api` keys and the four pack operations against `docs/api/openapi.yaml`
- [ ] Sample test checks the `createGameSession` request built from a given setup state
