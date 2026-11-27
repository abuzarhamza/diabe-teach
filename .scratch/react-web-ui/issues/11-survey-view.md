# 11: Feedback Survey

**Status:** ready-for-agent
**Blocked by:** 05

**What to build:** `sessionsApi.submitSurvey`; `views/SurveyView.tsx` — one Likert row (1..5) per item in the session pack's `perceptionSurvey.items` (`id`, `prompt`), plus optional comments. The body is `{ responses: { <item id>: 1..5 }, comments? }`. `perceptionSurvey` may be `null`: then show that this pack has no survey. The number of items comes from the pack, not a fixed 9.

## Acceptance criteria
- [ ] `web/tests/features/game-session/survey-view.test.tsx` (rendered over the fake fetch): Submit disabled until every item of the pack is rated; the request carries a `responses` map keyed by item `id`; confirmation shown after submit (`recordedItemCount`).
- [ ] A pack with `perceptionSurvey: null` shows no form.
- [ ] `SURVEY_ALREADY_SUBMITTED` and `SURVEY_COMMENTS_TOO_LONG` show in `ErrorBanner`.
