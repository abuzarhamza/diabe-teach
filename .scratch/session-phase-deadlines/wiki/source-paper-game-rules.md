# Source: game rules in the Diabe-teach paper

Source: `papers/diabe-teach.pdf` (Shadan et al., *BMC Medical Education* (2025) 25:17). Read on 2026-11-17 via text extraction (pypdf). Facts below are paraphrased from the paper.

- 49 keyword cards in a 7×7 grid. Each player builds chains of at least 4 keywords; each keyword must touch the next "horizontally or diagonally".
- Trial round of 15 minutes, then two rounds of about 30 minutes each: 20 minutes to form and record chains, then 10 minutes to explain them. The board is reshuffled before each round.
- Chains are approved by consensus among team members; the instructor resolves ambiguities, and that ruling is final.
- **Winner: the participant with the longest chain; ties go to the participant with the most chains.** There are no points.
- **The paper says nothing about duplicate chains, reversed chains, or teams submitting the same chain.**

## Implications
- 2026-11-17: Session-write-integrity ticket 05 ("no repeat chains from the same team; a reverse counts as the same") is a **project decision by the user and Claude, not a paper rule**. On 2026-11-17 the user explicitly confirmed that a reversed chain cannot be submitted by the same team. Under the paper's winner rule, a repeat only affects the tie-break (most chains).
- 2026-11-17: Default timers (1200s mapping, 600s adjudication, 900s trial) match the paper's 20/10/15 minutes.
- Related: [timed or instructor-driven phases](decision-timed-or-instructor-driven-phases.md).
