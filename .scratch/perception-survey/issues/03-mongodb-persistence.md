# 03: Add survey persistence to MongoDB

**What to build:** MongoDB schema extension and repository updates so survey responses survive server restarts. When a session is loaded from the database, any previously submitted survey is rehydrated into the `GameSession` aggregate.

**Blocked by:** 02-survey-response-entity

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` and `f52ba83` (route `POST /api/v1/sessions/{sessionId}/survey`, `netlify/functions/submit-survey.ts`; tests `tests/functions/submit-survey.test.ts`, `survey-journey.feature`).

- [ ] Add `SurveyResponseDocument` interface to `mongo-game-session-repository.types.ts`
- [ ] Add `surveyResponse` field to `GameSessionDocument` interface
- [ ] Add `surveyResponseSchema` subdocument schema to `game-session.schema.ts`
- [ ] Add `surveyResponse` field to `gameSessionSchema`
- [ ] Update `MongoGameSessionRepository.#toDomain()` to rehydrate survey response
- [ ] Update `MongoGameSessionRepository.#toDocument()` to serialize survey response
