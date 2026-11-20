import type { APIGatewayProxyEvent } from "aws-lambda";
import type { LikertRating } from "../../src/domain/game-session/game-session.types.js";
import { describe, expect, it } from "vitest";
import { createSubmitSurveyHandler } from "../../netlify/functions/sessions/submit-survey.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

/**
 * Valid perception survey item IDs from diabe-teach pack.
 */
const VALID_SURVEY_ITEM_IDS = [
  "survey-q1",
  "survey-q2",
  "survey-q3",
  "survey-q4",
  "survey-q5",
  "survey-q6",
  "survey-q7",
  "survey-q8",
  "survey-q9",
];

function makeEvent(
  sessionId: string,
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/survey`,
    headers: { "content-type": "application/json", ...headers },
    queryStringParameters: null,
    pathParameters: { sessionId },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

/**
 * Helper to transition a session through all phases up to feedback-survey.
 */
function transitionToFeedbackSurvey(session: GameSession): void {
  session.transitionTo("trial-orientation", new Date());
  session.transitionTo("round-1:chain-mapping", new Date());
  session.transitionTo("round-1:peer-adjudication", new Date());
  session.transitionTo("round-1:round-summary", new Date());
  session.transitionTo("round-2:chain-mapping", new Date());
  session.transitionTo("round-2:peer-adjudication", new Date());
  session.transitionTo("round-2:round-summary", new Date());
  session.transitionTo("posttest", new Date());
  session.transitionTo("feedback-survey", new Date());
}

/**
 * Helper to create a session in the feedback-survey phase.
 */
function makeFeedbackSurveySession(): GameSession {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  transitionToFeedbackSurvey(session);
  return session;
}

/**
 * Helper to create a session that is NOT in feedback-survey phase.
 */
function makePosttestSession(): GameSession {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  session.transitionTo("trial-orientation", new Date());
  session.transitionTo("round-1:chain-mapping", new Date());
  session.transitionTo("round-1:peer-adjudication", new Date());
  session.transitionTo("round-1:round-summary", new Date());
  session.transitionTo("round-2:chain-mapping", new Date());
  session.transitionTo("round-2:peer-adjudication", new Date());
  session.transitionTo("round-2:round-summary", new Date());
  session.transitionTo("posttest", new Date());
  return session;
}

/**
 * Build all valid survey responses (all 9 items with Likert value 4).
 */
function makeAllResponses(): Record<string, LikertRating> {
  const responses: Record<string, LikertRating> = {};
  for (const itemId of VALID_SURVEY_ITEM_IDS) {
    responses[itemId] = 4;
  }
  return responses;
}

/**
 * Build partial survey responses (only some items).
 */
function makePartialResponses(): Record<string, LikertRating> {
  return {
    "survey-q1": 5,
    "survey-q3": 3,
    "survey-q5": 4,
  };
}

/**
 * Generate a string with exactly N words.
 */
function generateWordsString(wordCount: number): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(`word${i}`);
  }
  return words.join(" ");
}

describe("pOST /api/v1/sessions/{sessionId}/survey", () => {
  describe("successful survey submission", () => {
    it("returns 201 with receipt for valid survey during feedback-survey phase", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Alice");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.participantId).toBe(participant.participantId);
      expect(body.recordedItemCount).toBe(9);
      expect(body.submittedAt).toBeDefined();
    });

    it("returns 201 with correct recordedItemCount for partial responses", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Bob");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makePartialResponses(),
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.recordedItemCount).toBe(3);
    });

    it("returns 201 and stores optional comments", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Charlie");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const comments = "This was a great learning experience!";
      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
          comments,
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.participantId).toBe(participant.participantId);

      // Verify comments were stored in the session
      const updatedSession = await sessionRepo.findById(session.sessionId);
      expect(updatedSession?.getSurveyResponse(participant.participantId)?.comments).toBe(comments);
    });

    it("returns 201 for comments with exactly 1000 words (boundary)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Diana");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const comments = generateWordsString(1000);
      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
          comments,
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
    });

    it("returns 201 and silently ignores unknown item IDs", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Eve");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      // Mix valid and invalid item IDs
      const responses: Record<string, LikertRating> = {
        "survey-q1": 5,
        "survey-q2": 4,
        "unknown-item-1": 3,
        "unknown-item-2": 2,
        "made-up-id": 1,
      };

      const event = makeEvent(
        session.sessionId.value,
        { responses },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      // Only valid item IDs should be recorded
      expect(body.recordedItemCount).toBe(2);
    });
  });

  describe("validation errors", () => {
    it("returns 422 for comments with 1001 words (over limit)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Frank");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const comments = generateWordsString(1001);
      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
          comments,
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("SURVEY_COMMENTS_TOO_LONG");
    });

    it("returns 400 naming the item for invalid Likert value 0 (request schema, api-hardening 06)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Grace");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const responses = {
        "survey-q1": 0, // Invalid: 0 is not a valid Likert value
      };

      const event = makeEvent(
        session.sessionId.value,
        { responses },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("INVALID_REQUEST_BODY");
      expect(body.details).toEqual({ field: "responses.survey-q1", reason: "must be one of: 1, 2, 3, 4, 5" });
    });

    it("returns 400 naming the item for invalid Likert value 6 (request schema, api-hardening 06)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Henry");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const responses = {
        "survey-q1": 6, // Invalid: 6 is not a valid Likert value
      };

      const event = makeEvent(
        session.sessionId.value,
        { responses },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("INVALID_REQUEST_BODY");
      expect(body.details).toEqual({ field: "responses.survey-q1", reason: "must be one of: 1, 2, 3, 4, 5" });
    });

    it("returns 400 naming the item for negative Likert value (request schema, api-hardening 06)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Ivy");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const responses = {
        "survey-q1": -1, // Invalid: negative number
      };

      const event = makeEvent(
        session.sessionId.value,
        { responses },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("INVALID_REQUEST_BODY");
      expect(body.details).toEqual({ field: "responses.survey-q1", reason: "must be one of: 1, 2, 3, 4, 5" });
    });

    it("returns 400 naming the item for string Likert value (request schema, api-hardening 06)", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Jack");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const responses = {
        "survey-q1": "five", // Invalid: string instead of number
      };

      const event = makeEvent(
        session.sessionId.value,
        { responses },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("INVALID_REQUEST_BODY");
      expect(body.details).toEqual({ field: "responses.survey-q1", reason: "must be an integer" });
    });
  });

  describe("phase restrictions", () => {
    it("returns 409 when submitting outside feedback-survey phase", async () => {
      const session = makePosttestSession(); // Not in feedback-survey phase
      const participant = session.addParticipant("Kate");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    });
  });

  describe("duplicate submission prevention", () => {
    it("returns 409 when survey already submitted", async () => {
      const session = makeFeedbackSurveySession();
      const participant = session.addParticipant("Leo");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
        },
        { authorization: `Bearer ${token}` },
      );

      // First submission should succeed
      const response1 = await handler(event, {} as never);
      expect(response1.statusCode).toBe(201);

      // Second submission should fail
      const response2 = await handler(event, {} as never);
      expect(response2.statusCode).toBe(409);
      const body = JSON.parse(response2.body);
      expect(body.code).toBe("SURVEY_ALREADY_SUBMITTED");
    });
  });

  describe("per-participant responses", () => {
    function setUpTwoParticipants() {
      const session = makeFeedbackSurveySession();
      const alice = session.addParticipant("Alice");
      const bob = session.addParticipant("Bob");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const tokenAdapter = new FakeCapabilityTokenAdapter();
      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo: new InMemoryCurriculumPackRepository(),
        tokenVerifier: tokenAdapter,
      });
      const submit = async (participantId: string, responses: Record<string, LikertRating>) => {
        const token = await tokenAdapter.signToken({
          role: "participant",
          sessionId: session.sessionId.value,
          participantId,
        });
        return handler(
          makeEvent(session.sessionId.value, { responses }, { authorization: `Bearer ${token}` }),
          {} as never,
        );
      };
      const storedResponseOf = async (participantId: string) =>
        (await sessionRepo.findById(session.sessionId))?.getSurveyResponse(participantId);
      return { alice, bob, submit, storedResponseOf };
    }

    it("accepts a survey from each of two participants", async () => {
      const { alice, bob, submit } = setUpTwoParticipants();

      const aliceResponse = await submit(alice.participantId, makeAllResponses());
      const bobResponse = await submit(bob.participantId, makePartialResponses());

      expect(aliceResponse.statusCode).toBe(201);
      expect(bobResponse.statusCode).toBe(201);
      expect(JSON.parse(bobResponse.body).participantId).toBe(bob.participantId);
      expect(JSON.parse(bobResponse.body).recordedItemCount).toBe(3);
    });

    it("rejects a participant's repeat without affecting the other participant's response", async () => {
      const { alice, bob, submit, storedResponseOf } = setUpTwoParticipants();

      await submit(alice.participantId, makeAllResponses());
      await submit(bob.participantId, makePartialResponses());
      const repeat = await submit(bob.participantId, makeAllResponses());
      const aliceRepeat = await submit(alice.participantId, makePartialResponses());

      expect(repeat.statusCode).toBe(409);
      expect(JSON.parse(repeat.body).code).toBe("SURVEY_ALREADY_SUBMITTED");
      expect(aliceRepeat.statusCode).toBe(409);
      expect(JSON.parse(aliceRepeat.body).code).toBe("SURVEY_ALREADY_SUBMITTED");
      expect((await storedResponseOf(alice.participantId))?.responses.size).toBe(9);
      expect((await storedResponseOf(bob.participantId))?.responses.size).toBe(3);
    });
  });

  describe("authorization", () => {
    it("returns 401 without token", async () => {
      const session = makeFeedbackSurveySession();
      session.addParticipant("Mary");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
        },
        {}, // No authorization header
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("UNAUTHORIZED_TOKEN");
    });

    it("returns 403 for instructor token", async () => {
      const session = makeFeedbackSurveySession();
      session.addParticipant("Nancy");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "instructor",
        sessionId: session.sessionId.value,
      });

      const handler = createSubmitSurveyHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        {
          responses: makeAllResponses(),
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("FORBIDDEN_ROLE");
    });
  });
});
