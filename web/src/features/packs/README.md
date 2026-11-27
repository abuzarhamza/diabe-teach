# Shared Curriculum Pack Library Feature (`web/src/features/packs/`)

- `pack-hooks.ts`: the only packs file that imports TanStack Query. `packKeys` (cache names: `all`, `list(includeArchived)`, `detail(packId)`), `usePackList(includeArchived)`, `usePack(packId)`, `useArchivePack()`, `useUnarchivePack()`. A pack change invalidates `packKeys.all`, so every pack screen refetches (no `useEffect`).
- `PackLibraryPage.tsx` (`/packs`): the library, "Show archived", Archive / Unarchive (never on a System Pack), "Start Game with Pack" (`/setup?packId=`).
- `PackDetailPage.tsx` (`/packs/:packId`): board, Semantic Domains, Keyword Cards, Adjudication Rubric, assessment questions and survey items (either may be `null`).

Calls are in `web/src/api/packs-api.ts`; wording (byline, board summary, refusal sentences) in `web/src/domain/pack-library.ts`.
