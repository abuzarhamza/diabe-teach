# 03: Add survey persistence to MongoDB

**What to build:** MongoDB schema extension and repository updates so survey responses survive server restarts. When a session is loaded from the database, any previously submitted survey is rehydrated into the `GameSession` aggregate.

**Blocked by:** 02-survey-response-entity

**Status:** ready-for-agent

- [ ] Add `SurveyResponseDocument` interface to `mongo-game-session-repository.types.ts`
- [ ] Add `surveyResponse` field to `GameSessionDocument` interface
- [ ] Add `surveyResponseSchema` subdocument schema to `game-session.schema.ts`
- [ ] Add `surveyResponse` field to `gameSessionSchema`
- [ ] Update `MongoGameSessionRepository.#toDomain()` to rehydrate survey response
- [ ] Update `MongoGameSessionRepository.#toDocument()` to serialize survey response
