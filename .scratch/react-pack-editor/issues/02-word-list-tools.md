# 02: Word list tools: upload, copy from a pack, remove, clear, and notes

**What to build:** The teacher has every way the prototype offers to build the word list:
- **Upload .txt or .csv…** reads the file in the browser; nothing is uploaded to the server. Its text goes through the same word cleaning as pasting, which also unquotes CSV-style `"…"` values.
- **Start from an existing pack** offers a pack picker with **Copy its words**, which adds that pack's card labels.
- Each chip has a remove button labelled "Remove <word>".
- **Clear all** empties the list.

A polite live note says how many words were added and how many duplicates or blanks were dropped. A second note says how many more words are needed (at least 9, for a 3 × 3 board) or which board size the list allows. Words longer than 60 characters are refused, with a sentence.

**Blocked by:** 01 (Teacher publishes a new pack from pasted words)

**Status:** done

**Spec:** `../spec.md`

- [x] Screen test: uploading a `.csv` with quoted values and a repeated word gives the right chips and the "dropped" note.
- [x] Screen test: Copy its words, from a pack served by the fake fetch, adds that pack's labels and skips ones already in the list.
- [x] Screen test: Remove <word> and Clear all update the chips and the count.
- [x] Screen test: with 5 words, the note says 4 more are needed; with 16 it names a 4 × 4 board.
- [x] Screen test: the added/dropped note is in a polite live region; the chips have accessible remove buttons.
- [x] Manual check in Chrome against `dev:prototype`: upload a real `.csv` and copy words from a System Pack.

## Comments

**2026-11-27 (built):**
- `web/src/domain/pack-editor.ts` gains `addWords(current, input)` (returns the merged list plus `added`, `duplicates` (in the input and against the list) and `empty`), `wordsAddedNote(result, source?)` ("Added 3 words. Dropped 1 duplicate and 1 blank entry."; with a source, "From words.csv: added …"), `wordCountNote(n)` (below 9: "Add at least N more to publish (a pack needs 9, for a 3 × 3 board)."; else "N words: enough for a S × S board." using `newPackBoardSize`), `packWords(pack)` (displayLabel, else verbatimLabel, as the prototype's `toGamePack`), `wordFileProblem(file)` (not .txt/.csv, or over 1 MB) and `MAX_WORD_LENGTH`. `newPackProblem` now also refuses a word over 60 characters ("Keep each word to 60 characters or fewer (“…”).", focus on the paste box), checked after the word count and the name.
- `pack-hooks.ts`: `useFetchPack()`, a mutation that reads a pack through `queryClient.fetchQuery` on `packKeys.detail(id)`, so Copy its words shares Pack Detail's cache. **Ticket 04** (new version prefill) can reuse it or `usePack`.
- `PackEditorPage`: Start from an existing pack (`select`, from `usePackList(false)`; defaults to the first pack) + Copy its words (fills the name with "<title> (my copy)" when empty, as the prototype does); hidden file input with a `label.btn` "Upload .txt or .csv…" (read with `file.text()`; refusals go to the existing `role="alert"`); chips with "Remove <word>" buttons (focus moves to the next chip's button, else the previous one, else the paste box; done by focusing before the state update, since chips are keyed by word, so no `useEffect` or `flushSync`); Clear all; the "Words added" polite status note; `#pack-size-note` is the chip list's `aria-describedby`. One `ErrorBanner` shows a publish refusal, else a copy refusal. The added note is per action (what this add did), not the prototype's running "Removed so far" total.
- Tests: 7 new screen tests in `web/tests/features/packs/pack-editor.test.tsx` (16 in all), including a non-.txt refusal (`userEvent.setup({ applyAccept: false })`) and the 60-character refusal. The `chips()` helper now reads each chip's word span, since chips contain a button.
- Manual check: verify-diabe-teach-web run `proof-web-pack-editor-02`: a real `words.csv` uploaded with `file_upload`, Copy its words from the `diabe-teach` System Pack (47 added, 2 duplicates; API shows 49 cards), Remove/Clear all, and multi-line typing into the textarea all passed. Recipe and the multi-line typing recipe added to `features/pack-editor.md`.
