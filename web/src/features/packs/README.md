# Shared Curriculum Pack Library Feature (`web/src/features/packs/`)

- `pack-hooks.ts`: the only packs file that imports TanStack Query. `packKeys` (cache names: `all`, `list(includeArchived)`, `detail(packId)`), `usePackList(includeArchived)`, `usePack(packId)`, `useFetchPack()` (a pack's content on demand, through the detail cache), `useArchivePack()`, `useUnarchivePack()`, `usePublishPack()` (reads every pack id with `includeArchived=true`, builds the pack, registers it). A pack change invalidates `packKeys.all`, so every pack screen refetches (no `useEffect`).
- `PackLibraryPage.tsx` (`/packs`): the library, "Show archived", Archive / Unarchive (never on a System Pack), "Start Game with Pack" (`/setup?packId=`).
- `PackEditorPage.tsx` (`/packs/new`): build the word list by pasting, uploading a `.txt`/`.csv` (read in the browser) or copying an existing pack's words; chips with Remove buttons, Clear all, the count, a polite added/dropped note and a words-needed / board-size note; name, level, objective; Publish (local checks first, then register and open Pack Detail), Cancel.
- `PackDetailPage.tsx` (`/packs/:packId`): board, Semantic Domains, Keyword Cards, Adjudication Rubric, assessment questions and survey items (either may be `null`).

Calls are in `web/src/api/packs-api.ts`; wording (byline, board summary, refusal sentences) in `web/src/domain/pack-library.ts`; word cleaning, the word list notes, ids and the new-pack body in `web/src/domain/pack-editor.ts`.
