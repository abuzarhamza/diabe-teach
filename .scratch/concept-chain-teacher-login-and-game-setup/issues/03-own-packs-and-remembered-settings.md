# 03: Create, save and delete your own packs, and remembered settings

**What to build:** On Game setup, a teacher can create a new Curriculum Pack by pasting keywords, uploading a .txt or .csv file, or starting from an existing pack and editing it. Duplicates and empty entries are removed with a running count, and the teacher is warned when there are fewer keywords than the chosen board size needs (e.g. 49 for 7×7). The pack gets a name, learner level and learning objective. Teacher-created packs are saved in the browser, appear in the pack list next to built-in ones, and can be deleted (built-in packs can't). Shortest chain and board size controls are added to Time allotment. Game setup remembers the last pack and settings and pre-fills them next time. See `../spec.md` → user stories 10–18, 24–25, 33.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Paste, file upload (.txt/.csv) and "start from existing pack" all fill the keyword list
- [ ] Dedupe and empty-removal with a visible count; board-size shortfall warning
- [ ] Name, learner level and objective saved with the pack; objective shown on the teacher screen
- [ ] Saved packs persist across reloads and can be deleted; built-in packs have no delete
- [ ] Shortest chain and board size settings reach the session (too-short chains rejected; board uses chosen size)
- [ ] Last-used pack and settings pre-filled on the next visit
