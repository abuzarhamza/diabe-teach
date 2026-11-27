# 10: Round Summary standings

**Status:** ready-for-agent
**Blocked by:** 09

**What to build:** `sessionsApi.getRoundStandings` (round from `state.activeRoundNumber`); `views/RoundSummaryView.tsx`. Each `PlayerRoundStanding` has `rank`, `participantId`, `longestValidChainLength`, `totalValidChainsCount` and `approvedChainIds`. Show the learner's name from `state.participants`, matched by `participantId` (the contract's `displayName` on a standing is optional and nullable, so do not rely on it). Show the approved chain count as `approvedChainIds.length`. Highlight the current learner (their seat's `participantId`). Only learners with at least one approved chain are listed.

## Acceptance criteria
- [ ] `web/tests/features/game-session/round-summary-view.test.tsx` (rendered over the fake fetch): standings render sorted by rank for rounds 1 and 2, with names taken from `state.participants`.
