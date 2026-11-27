# 02: Word list tools: upload, copy from a pack, remove, clear, and notes

**What to build:** The teacher has every way the prototype offers to build the word list:
- **Upload .txt or .csv…** reads the file in the browser; nothing is uploaded to the server. Its text goes through the same word cleaning as pasting, which also unquotes CSV-style `"…"` values.
- **Start from an existing pack** offers a pack picker with **Copy its words**, which adds that pack's card labels.
- Each chip has a remove button labelled "Remove <word>".
- **Clear all** empties the list.

A polite live note says how many words were added and how many duplicates or blanks were dropped. A second note says how many more words are needed (at least 9, for a 3 × 3 board) or which board size the list allows. Words longer than 60 characters are refused, with a sentence.

**Blocked by:** 01 (Teacher publishes a new pack from pasted words)

**Status:** ready-for-agent

**Spec:** `../spec.md`

- [ ] Screen test: uploading a `.csv` with quoted values and a repeated word gives the right chips and the "dropped" note.
- [ ] Screen test: Copy its words, from a pack served by the fake fetch, adds that pack's labels and skips ones already in the list.
- [ ] Screen test: Remove <word> and Clear all update the chips and the count.
- [ ] Screen test: with 5 words, the note says 4 more are needed; with 16 it names a 4 × 4 board.
- [ ] Screen test: the added/dropped note is in a polite live region; the chips have accessible remove buttons.
- [ ] Manual check in Chrome against `dev:prototype`: upload a real `.csv` and copy words from a System Pack.
