# 08: `GET /api/v1/sessions/{sessionId}/rounds/{n}/standings` - Round standings

**What to build:** Fetch the ranked leaderboard for a specific round showing each participant's longest valid chain length, total valid chains count, cumulative rationale score, and approved chain IDs. Rankings are sorted by longest chain (primary) then total valid chains (tiebreaker). Includes `isFinalized` flag indicating whether the round adjudication is complete.

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint, 06-submit-chain-endpoint

**Status:** ready-for-agent

- [ ] `GetRoundStandingsUseCase` in `src/application/use-cases/`
- [ ] Port definition with `GetStandingsQuery` and `RoundStandingsResult` DTO
- [ ] `PlayerRoundStanding` DTO: rank, participantId, displayName, longestValidChainLength, totalValidChainsCount, cumulativeRationaleScore, approvedChainIds
- [ ] HTTP handler `netlify/functions/sessions/get-standings.ts` with Middy middleware
- [ ] Compute standings from approved chains (status=approved or verdict.isApproved=true)
- [ ] Sort by longestValidChainLength DESC, then totalValidChainsCount DESC
- [ ] Assign ranks (handling ties appropriately)
- [ ] Error: `SESSION_NOT_FOUND` (404) when sessionId doesn't exist
- [ ] Error: `ROUND_NOT_FOUND` (404) when round number is invalid (not 1 or 2)
- [ ] Tests covering: standings computation, tie handling, empty standings, invalid round
