# 03: Pack Library and Pack Detail

**Status:** ready-for-agent
**Blocked by:** 01 (done, satisfied)

**What to build:** `web/src/api/packs-api.ts` (`listPacks`, `getPackById`, `archivePack`, `unarchivePack`); `features/packs/pack-hooks.ts` (the only packs file that imports TanStack Query); `/packs` (`PackLibraryPage`: list, "Show archived" toggle, archive/unarchive, "Start Game with Pack" → `/setup?packId=`); `/packs/:packId` (`PackDetailPage`: boardConfig, Semantic Domains, Keyword Cards, Adjudication Rubric, assessment questions, survey items from `perceptionSurvey.items`, either of which may be `null`). Both routes use the existing teacher guard (`TeacherRoute`). Look from the pack panel of `setup.html`.

**Open question:** the pack list has no System Pack flag, so "no archive control for System Packs" cannot be built yet. See spec, "Open questions (need the user)", (a).

## Acceptance criteria
- [ ] `web/tests/features/packs/pack-library.test.tsx` (rendered `/packs` over the fake fetch): "Show archived" sends `includeArchived=true`; Archive / Unarchive call the right paths with the Account Token.
- [ ] Archive/unarchive refreshes the list via query invalidation (no `useEffect`).
- [ ] System Packs: done as the user decides in open question (a), either no archive control (API flag) or the 403 `PACK_IS_SYSTEM_PACK` explained in `ErrorBanner`.
- [ ] Signed-out users are sent to `/login` with the reason (react-login-screen 05).
