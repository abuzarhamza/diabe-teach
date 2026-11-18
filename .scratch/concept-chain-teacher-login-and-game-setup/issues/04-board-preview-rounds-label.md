# 04: Board preview with Shuffle, fixed rounds and the Round 2 label

**What to build:** Game setup shows a **Board preview**: the board the class will get, dealt from the chosen pack at the chosen size, with a **Shuffle** button that re-deals with a new seed. The preview re-deals when the pack or board size changes, and "Start game" passes the preview's seed so Round 1 uses exactly that board. Time allotment shows **"Rounds: 2"** read-only with the note "Each round gets a freshly shuffled board". On the teacher screen, the phase button at the end of Round 1 reads **"Start Round 2 · new board →"**. There is no reshuffle during a round. See `../spec.md` → Solution 2–3, Implementation Decisions (Board preview and seed, Rounds, Round button wording), user stories 43–49.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Preview renders with the shared board renderer and matches the chosen pack and size
- [ ] Shuffle changes the layout; changing pack or size re-deals
- [ ] The teacher screen's and learners' Round 1 board is identical to the last preview
- [ ] "Rounds: 2" shown read-only with the fresh-shuffle note
- [ ] Round 1 summary → button label "Start Round 2 · new board →"; Round 2 gets a different board
