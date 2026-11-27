# 03: Pack Library and Pack Detail

**Status:** done
**Blocked by:** 01 (done, satisfied); react-packs 00 (`isSystemPack` API flag)

**What to build:** `web/src/api/packs-api.ts` (`listPacks`, `getPackById`, `archivePack`, `unarchivePack`); `features/packs/pack-hooks.ts` (the only packs file that imports TanStack Query); `/packs` (`PackLibraryPage`: list, "Show archived" toggle, archive/unarchive, "Start Game with Pack" → `/setup?packId=`); `/packs/:packId` (`PackDetailPage`: boardConfig, Semantic Domains, Keyword Cards, Adjudication Rubric, assessment questions, survey items from `perceptionSurvey.items`, either of which may be `null`). Both routes use the existing teacher guard (`TeacherRoute`). Look from the pack panel of `setup.html`.

**System Packs:** decided by the user on 2026-11-27: the API flag `isSystemPack` (react-packs 00) marks them; no archive control on System Packs.

## Acceptance criteria
- [x] `web/tests/features/packs/pack-library.test.tsx` (rendered `/packs` over the fake fetch): "Show archived" sends `includeArchived=true`; Archive / Unarchive call the right paths with the Account Token.
- [x] Archive/unarchive refreshes the list via query invalidation (no `useEffect`).
- [x] System Packs (`isSystemPack: true`) show no Archive or Unarchive control; a 403 `PACK_IS_SYSTEM_PACK` is still explained in `ErrorBanner` as a fallback.
- [x] Signed-out users are sent to `/login` with the reason (react-login-screen 05).

## Comments

**2026-11-27 (built):**
- `web/src/api/packs-api.ts`: `listPacks({ includeArchived })`, `getPackById(packId)`, `archivePack(packId)`, `unarchivePack(packId)`, plus the contract types (`CurriculumPackListItem`, `CurriculumPackDetail`, `BoardConfig`, `SemanticDomain`, `KeywordCard`, `AdjudicationRubric`, `CalibrationExample`, `PublicAssessmentQuestion`, `PerceptionSurveyItem`). List and detail send no token (answer keys stay redacted); archive/unarchive send the Account Token and refuse with a local 401 before sending when signed out.
- `web/src/features/packs/pack-hooks.ts`: `packKeys` (`all`, `list(includeArchived)`, `detail(packId)`), `usePackList`, `usePack`, `useArchivePack`, `useUnarchivePack`. A change invalidates `packKeys.all` and the mutation stays pending until the refetch lands. **For the Pack Editor (react-pack-editor):** add `validatePack`/`registerPack` to `packs-api.ts` and `useValidatePack`/`useRegisterPack` here, and invalidate `packKeys.all` on register, reusing the private `useRefreshPacks`.
- `web/src/domain/pack-library.ts`: `packByline`, `boardSummary`, `packRefusalSentence` (sentences copied from the prototype's `packErrorText`; unknown codes keep the server's message).
- Screens: `PackLibraryPage` (`/packs`) and `PackDetailPage` (`/packs/:packId`) under `TeacherRoute`. System Packs get no Archive/Unarchive. Archived packs get no Start. `Start Game with Pack` links to `/setup?packId=` (Game Setup ticket 05 should read that param). The library CSS comes from setup.html's pack panel and is appended to `web/src/styles.css`.
- Test seam: `web/tests/support/fake-fetch.ts` now records `query` and passes the request to function answers. `web/tests/support/pack-fixtures.ts` holds the contract-shaped pack bodies for later pack tests.
- Not done or not in scope: no link to `/packs` from `/setup` or the TopBar yet (reach it by URL). There is no archive control on Pack Detail, because the detail response has no `isArchived`. There is no success message after Archive/Unarchive.
- Manual check: verify-diabe-teach-web run `proof-web-pack-library`, recipe `features/pack-library.md`, all bullets passed.
