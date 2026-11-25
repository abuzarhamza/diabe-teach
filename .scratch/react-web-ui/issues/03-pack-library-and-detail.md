# 03: Pack Library and Pack Detail

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:** `packs-api.ts` (`listPacks`, `getPackById`, `archivePack`, `unarchivePack`); `/packs` (`PackLibraryPage`: list, "Show archived" toggle, archive/unarchive non-system packs, "Start Game with Pack" → `/setup?packId=`); `/packs/:packId` (`PackDetailPage`: boardConfig, Semantic Domains, Keyword Cards, Adjudication Rubric, assessment questions, survey items). Look from the pack panel of `setup.html`.

## Acceptance criteria
- [ ] API wrapper test (mocked fetch) for `includeArchived` query and archive/unarchive paths.
- [ ] Archive/unarchive refreshes the list via query invalidation (no `useEffect`).
- [ ] System packs show no archive control; signed-out users are sent to `/login`.
