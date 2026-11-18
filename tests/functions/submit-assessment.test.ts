import type { APIGatewayProxyEvent } from "aws-lambda";
import type { AssessmentStageSummary, PosttestSubmissionResult, QuestionReviewItem } from "../../src/application/ports/submit-assessment.port.js";
import { describe, expect, it } from "vitest";
import { createSubmitAssessmentHandler } from "../../netlify/functions/sessions/submit-assessment.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryGameSessionRepository } from "../../src/adapters/outbound/in-memory-game-session-repository.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function makeEvent(
  sessionId: string,
  stage: "pretest" | "posttest",
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/sessions/${sessionId}/assessments/${stage}`,
    headers: { "content-type": "application/json", ...headers },
    queryStringParameters: null,
    pathParameters: { sessionId, stage },
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
 * Helper to create a session in pretest phase with a participant.
 */
function makePretestSession() {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  // Session starts in pretest phase by default
  return session;
}

/**
 * Helper to create a session in posttest phase with a participant.
 */
function makePosttestSession() {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });
  // Transition through all phases to posttest
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
 * Helper to create a session in posttest phase with a pretest already submitted.
 * This is required because posttest now requires pretest prerequisite.
 */
function makePosttestSessionWithPretest(participantId: string) {
  const session = GameSession.create({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  });

  // Submit pretest (session starts in pretest phase)
  session.submitAssessment(participantId, "pretest", new Map(Object.entries(makeAllIdkAnswers())));

  // Transition through all phases to posttest
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
 * Build answers where all questions are answered with I_DONT_KNOW.
 */
function makeAllIdkAnswers(): Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> {
  return {
    "dm-mcq-01": "I_DONT_KNOW",
    "dm-mcq-02": "I_DONT_KNOW",
    "dm-mcq-03": "I_DONT_KNOW",
    "dm-mcq-04": "I_DONT_KNOW",
    "dm-mcq-05": "I_DONT_KNOW",
    "dm-mcq-06": "I_DONT_KNOW",
    "dm-mcq-07": "I_DONT_KNOW",
    "dm-mcq-08": "I_DONT_KNOW",
    "dm-mcq-09": "I_DONT_KNOW",
    "dm-mcq-10": "I_DONT_KNOW",
  };
}

/**
 * Build answers where all questions are answered correctly.
 * Based on DIABE_TEACH_PACK assessment instrument.
 */
function makeAllCorrectAnswers(): Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> {
  return {
    "dm-mcq-01": 0, // correctIndex: 0
    "dm-mcq-02": 1, // correctIndex: 1
    "dm-mcq-03": 1, // correctIndex: 1
    "dm-mcq-04": 0, // correctIndex: 0
    "dm-mcq-05": 0, // correctIndex: 0
    "dm-mcq-06": 0, // correctIndex: 0
    "dm-mcq-07": 0, // correctIndex: 0
    "dm-mcq-08": 0, // correctIndex: 0
    "dm-mcq-09": 0, // correctIndex: 0
    "dm-mcq-10": 0, // correctIndex: 0
  };
}

/**
 * Build answers where all questions are answered wrong (wrong guesses).
 */
function makeAllWrongGuessAnswers(): Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> {
  return {
    "dm-mcq-01": 1, // correct is 0
    "dm-mcq-02": 0, // correct is 1
    "dm-mcq-03": 0, // correct is 1
    "dm-mcq-04": 1, // correct is 0
    "dm-mcq-05": 1, // correct is 0
    "dm-mcq-06": 1, // correct is 0
    "dm-mcq-07": 1, // correct is 0
    "dm-mcq-08": 1, // correct is 0
    "dm-mcq-09": 1, // correct is 0
    "dm-mcq-10": 1, // correct is 0
  };
}

/**
 * Build mixed answers: 5 correct, 3 wrong guesses, 2 I_DONT_KNOW.
 */
function makeMixedAnswers(): Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> {
  return {
    "dm-mcq-01": 0, // correct (correct is 0)
    "dm-mcq-02": 1, // correct (correct is 1)
    "dm-mcq-03": 1, // correct (correct is 1)
    "dm-mcq-04": 0, // correct (correct is 0)
    "dm-mcq-05": 0, // correct (correct is 0)
    "dm-mcq-06": 2, // wrong guess (correct is 0)
    "dm-mcq-07": 3, // wrong guess (correct is 0)
    "dm-mcq-08": 2, // wrong guess (correct is 0)
    "dm-mcq-09": "I_DONT_KNOW",
    "dm-mcq-10": "I_DONT_KNOW",
  };
}

describe("POST /api/v1/sessions/{sessionId}/assessments/{stage}", () => {
  describe("pretest submission", () => {
    it("returns ungraded receipt for pretest", async () => {
      const session = makePretestSession();
      const participant = session.addParticipant("Alice");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.stage).toBe("pretest");
      expect(body.participantId).toBe(participant.participantId);
      expect(body.recordedCount).toBe(10);
      expect(body.submittedAt).toBeDefined();
      // Pretest should NOT include graded report
      expect(body.report).toBeUndefined();
      expect(body.answerKeyReview).toBeUndefined();
    });

    it("returns 409 when not in pretest phase", async () => {
      const session = makePosttestSession();
      const participant = session.addParticipant("Bob");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    });

    it("returns 422 for incomplete answers", async () => {
      const session = makePretestSession();
      const participant = session.addParticipant("Charlie");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      // Only answer 5 out of 10 questions
      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        {
          answers: {
            "dm-mcq-01": 0,
            "dm-mcq-02": 1,
            "dm-mcq-03": 1,
            "dm-mcq-04": 0,
            "dm-mcq-05": 0,
          },
        },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("ASSESSMENT_INCOMPLETE");
    });
  });

  describe("posttest submission", () => {
    it("returns graded result with metacognitive report", async () => {
      // First add participant, then create session with pretest submitted
      const participantId = "diana-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;
      expect(body.stage).toBe("posttest");
      expect(body.participantId).toBe(participantId);
      expect(body.submittedAt).toBeDefined();
      expect(body.report).toBeDefined();
      expect(body.answerKeyReview).toBeDefined();
      expect(body.answerKeyReview.length).toBe(10);
    });

    it("grades all correct answers with 100% correctPercentage", async () => {
      const participantId = "eve-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      const posttest = body.report.posttest as AssessmentStageSummary;
      expect(posttest.stage).toBe("posttest");
      expect(posttest.totalQuestions).toBe(10);
      expect(posttest.correctCount).toBe(10);
      expect(posttest.wrongGuessCount).toBe(0);
      expect(posttest.iDontKnowCount).toBe(0);
      expect(posttest.correctPercentage).toBe(100);
      expect(posttest.wrongGuessPercentage).toBe(0);
      expect(posttest.iDontKnowPercentage).toBe(0);
      // All correct means no wrong guesses or I_DONT_KNOW, so ratio = 1.0
      expect(posttest.uncertaintyCalibrationRatio).toBe(1.0);
    });

    it("grades all wrong guesses with 0% correctPercentage and 0 uncertaintyCalibrationRatio", async () => {
      const participantId = "frank-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllWrongGuessAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      const posttest = body.report.posttest as AssessmentStageSummary;
      expect(posttest.correctCount).toBe(0);
      expect(posttest.wrongGuessCount).toBe(10);
      expect(posttest.iDontKnowCount).toBe(0);
      expect(posttest.correctPercentage).toBe(0);
      expect(posttest.wrongGuessPercentage).toBe(100);
      expect(posttest.iDontKnowPercentage).toBe(0);
      // All wrong guesses, no I_DONT_KNOW: ratio = 0 / (0 + 10) = 0
      expect(posttest.uncertaintyCalibrationRatio).toBe(0);
    });

    it("grades all I_DONT_KNOW with 1.0 uncertaintyCalibrationRatio", async () => {
      const participantId = "grace-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      const posttest = body.report.posttest as AssessmentStageSummary;
      expect(posttest.correctCount).toBe(0);
      expect(posttest.wrongGuessCount).toBe(0);
      expect(posttest.iDontKnowCount).toBe(10);
      expect(posttest.correctPercentage).toBe(0);
      expect(posttest.wrongGuessPercentage).toBe(0);
      expect(posttest.iDontKnowPercentage).toBe(100);
      // All I_DONT_KNOW, no wrong guesses: ratio = 10 / (10 + 0) = 1.0
      expect(posttest.uncertaintyCalibrationRatio).toBe(1.0);
    });

    it("computes mixed metrics correctly: 5 correct, 3 wrong, 2 IDK", async () => {
      const participantId = "henry-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeMixedAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      const posttest = body.report.posttest as AssessmentStageSummary;
      expect(posttest.correctCount).toBe(5);
      expect(posttest.wrongGuessCount).toBe(3);
      expect(posttest.iDontKnowCount).toBe(2);
      expect(posttest.correctPercentage).toBe(50);
      expect(posttest.wrongGuessPercentage).toBe(30);
      expect(posttest.iDontKnowPercentage).toBe(20);
      // uncertaintyCalibrationRatio = 2 / (2 + 3) = 0.4
      expect(posttest.uncertaintyCalibrationRatio).toBe(0.4);
    });

    it("computes knowledge gain delta between pretest and posttest", async () => {
      // Start session in pretest
      const session = makePretestSession();
      const participant = session.addParticipant("Ivy");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      // Submit pretest with all IDK (0% correct)
      const pretestEvent = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      await handler(pretestEvent, {} as never);

      // Transition to posttest
      // Reload: the pretest submission saved a newer version of the session
      const submitted = await sessionRepo.findById(session.sessionId);
      submitted!.transitionTo("trial-orientation", new Date());
      submitted!.transitionTo("round-1:chain-mapping", new Date());
      submitted!.transitionTo("round-1:peer-adjudication", new Date());
      submitted!.transitionTo("round-1:round-summary", new Date());
      submitted!.transitionTo("round-2:chain-mapping", new Date());
      submitted!.transitionTo("round-2:peer-adjudication", new Date());
      submitted!.transitionTo("round-2:round-summary", new Date());
      submitted!.transitionTo("posttest", new Date());
      await sessionRepo.update(submitted!);

      // Submit posttest with all correct (100% correct)
      const posttestEvent = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(posttestEvent, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      // knowledgeGainDelta = posttest correct % - pretest correct % = 100 - 0 = 100
      expect(body.report.knowledgeGainDelta).toBe(100);
      // guessingReductionDelta = pretest wrong guess % - posttest wrong guess % = 0 - 0 = 0
      expect(body.report.guessingReductionDelta).toBe(0);

      // Verify pretest summary was computed
      const pretest = body.report.pretest as AssessmentStageSummary;
      expect(pretest.stage).toBe("pretest");
      expect(pretest.correctPercentage).toBe(0);
      expect(pretest.iDontKnowPercentage).toBe(100);
    });

    it("computes guessing reduction delta correctly", async () => {
      const session = makePretestSession();
      const participant = session.addParticipant("Jack");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      // Submit pretest with all wrong guesses (100% wrong guess)
      const pretestEvent = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllWrongGuessAnswers() },
        { authorization: `Bearer ${token}` },
      );

      await handler(pretestEvent, {} as never);

      // Transition to posttest
      // Reload: the pretest submission saved a newer version of the session
      const submitted = await sessionRepo.findById(session.sessionId);
      submitted!.transitionTo("trial-orientation", new Date());
      submitted!.transitionTo("round-1:chain-mapping", new Date());
      submitted!.transitionTo("round-1:peer-adjudication", new Date());
      submitted!.transitionTo("round-1:round-summary", new Date());
      submitted!.transitionTo("round-2:chain-mapping", new Date());
      submitted!.transitionTo("round-2:peer-adjudication", new Date());
      submitted!.transitionTo("round-2:round-summary", new Date());
      submitted!.transitionTo("posttest", new Date());
      await sessionRepo.update(submitted!);

      // Submit posttest with all correct (0% wrong guess)
      const posttestEvent = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(posttestEvent, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      // guessingReductionDelta = pretest wrong guess % - posttest wrong guess % = 100 - 0 = 100
      expect(body.report.guessingReductionDelta).toBe(100);
    });

    it("returns 409 when posttest submitted without completing pretest first", async () => {
      const session = makePosttestSession();
      const participant = session.addParticipant("Kate");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    });

    it("includes pretestChoice and posttestChoice in answerKeyReview", async () => {
      const session = makePretestSession();
      const participant = session.addParticipant("Leo");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      // Submit pretest
      const pretestAnswers = makeAllIdkAnswers();
      pretestAnswers["dm-mcq-01"] = 2; // Wrong guess on Q1
      const pretestEvent = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: pretestAnswers },
        { authorization: `Bearer ${token}` },
      );

      await handler(pretestEvent, {} as never);

      // Transition to posttest
      // Reload: the pretest submission saved a newer version of the session
      const submitted = await sessionRepo.findById(session.sessionId);
      submitted!.transitionTo("trial-orientation", new Date());
      submitted!.transitionTo("round-1:chain-mapping", new Date());
      submitted!.transitionTo("round-1:peer-adjudication", new Date());
      submitted!.transitionTo("round-1:round-summary", new Date());
      submitted!.transitionTo("round-2:chain-mapping", new Date());
      submitted!.transitionTo("round-2:peer-adjudication", new Date());
      submitted!.transitionTo("round-2:round-summary", new Date());
      submitted!.transitionTo("posttest", new Date());
      await sessionRepo.update(submitted!);

      // Submit posttest
      const posttestAnswers = makeAllCorrectAnswers();
      const posttestEvent = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: posttestAnswers },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(posttestEvent, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      const q1Review = body.answerKeyReview.find(
        (q: QuestionReviewItem) => q.questionId === "dm-mcq-01",
      );
      expect(q1Review).toBeDefined();
      expect(q1Review!.pretestChoice).toBe(2); // From pretest
      expect(q1Review!.posttestChoice).toBe(0); // From posttest (correct)
      expect(q1Review!.correctIndex).toBe(0);

      const q2Review = body.answerKeyReview.find(
        (q: QuestionReviewItem) => q.questionId === "dm-mcq-02",
      );
      expect(q2Review!.pretestChoice).toBe("I_DONT_KNOW");
      expect(q2Review!.posttestChoice).toBe(1);
    });

  });

  describe("chain diversity and neglected keywords", () => {
    it("computes chainDiversityIndex from participant chains", async () => {
      const participantId = "nancy-uuid";
      const session = makePosttestSessionWithPretest(participantId);

      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      // With 0 chains, chainDiversityIndex should be 0
      expect(body.report.chainDiversityIndex).toBe(0);

      // All 49 keywords should be neglected since no chains were submitted
      expect(body.report.neglectedKeywordIds.length).toBe(49);
    });

    it("returns all pack keywords as neglected when no chains submitted", async () => {
      const participantId = "oscar-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);
      const body = JSON.parse(response.body) as PosttestSubmissionResult;

      // DIABE_TEACH_PACK has 49 cards
      expect(body.report.neglectedKeywordIds.length).toBe(49);
    });
  });

  describe("duplicate submission prevention", () => {
    it("returns 409 for duplicate pretest submission", async () => {
      const session = makePretestSession();
      const participant = session.addParticipant("Peter");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId: participant.participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      // First submission should succeed
      const response1 = await handler(event, {} as never);
      expect(response1.statusCode).toBe(201);

      // Second submission should fail
      const response2 = await handler(event, {} as never);
      expect(response2.statusCode).toBe(409);
      const body = JSON.parse(response2.body);
      expect(body.code).toBe("ASSESSMENT_ALREADY_SUBMITTED");
    });

    it("returns 409 for duplicate posttest submission", async () => {
      const participantId = "quinn-uuid";
      const session = makePosttestSessionWithPretest(participantId);
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "posttest",
        { answers: makeAllCorrectAnswers() },
        { authorization: `Bearer ${token}` },
      );

      // First submission should succeed
      const response1 = await handler(event, {} as never);
      expect(response1.statusCode).toBe(201);

      // Second submission should fail
      const response2 = await handler(event, {} as never);
      expect(response2.statusCode).toBe(409);
      const body = JSON.parse(response2.body);
      expect(body.code).toBe("ASSESSMENT_ALREADY_SUBMITTED");
    });
  });

  describe("per-participant attempts", () => {
    function setUpTwoParticipants(session: GameSession) {
      const alice = session.addParticipant("Alice");
      const bob = session.addParticipant("Bob");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const tokenAdapter = new FakeCapabilityTokenAdapter();
      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo: new InMemoryCurriculumPackRepository(),
        tokenVerifier: tokenAdapter,
      });
      const tokenFor = (participantId: string) => tokenAdapter.signToken({
        role: "participant",
        sessionId: session.sessionId.value,
        participantId,
      });
      const submit = async (
        participantId: string,
        stage: "pretest" | "posttest",
        answers: Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW">,
      ) => handler(
        makeEvent(
          session.sessionId.value,
          stage,
          { answers },
          { authorization: `Bearer ${await tokenFor(participantId)}` },
        ),
        {} as never,
      );
      const advanceToPosttest = async () => {
        const current = await sessionRepo.findById(session.sessionId);
        for (const phase of [
          "trial-orientation",
          "round-1:chain-mapping",
          "round-1:peer-adjudication",
          "round-1:round-summary",
          "round-2:chain-mapping",
          "round-2:peer-adjudication",
          "round-2:round-summary",
          "posttest",
        ] as const) {
          current!.transitionTo(phase, new Date());
        }
        await sessionRepo.update(current!);
      };
      return {
        alice,
        bob,
        submit,
        advanceToPosttest,
      };
    }

    it("accepts a Pretest from each of two participants", async () => {
      const { alice, bob, submit } = setUpTwoParticipants(makePretestSession());

      const aliceResponse = await submit(alice.participantId, "pretest", makeAllIdkAnswers());
      const bobResponse = await submit(bob.participantId, "pretest", makeAllCorrectAnswers());

      expect(aliceResponse.statusCode).toBe(201);
      expect(bobResponse.statusCode).toBe(201);
      expect(JSON.parse(bobResponse.body).participantId).toBe(bob.participantId);
    });

    it("still rejects a participant's second Pretest after another participant submitted", async () => {
      const { alice, bob, submit } = setUpTwoParticipants(makePretestSession());

      await submit(alice.participantId, "pretest", makeAllIdkAnswers());
      await submit(bob.participantId, "pretest", makeAllIdkAnswers());
      const repeat = await submit(bob.participantId, "pretest", makeAllCorrectAnswers());

      expect(repeat.statusCode).toBe(409);
      expect(JSON.parse(repeat.body).code).toBe("ASSESSMENT_ALREADY_SUBMITTED");
    });

    it("rejects a Posttest from a participant without their own Pretest, even when another participant has one", async () => {
      const { alice, bob, submit, advanceToPosttest } = setUpTwoParticipants(makePretestSession());

      await submit(alice.participantId, "pretest", makeAllIdkAnswers());
      await advanceToPosttest();
      const bobPosttest = await submit(bob.participantId, "posttest", makeAllCorrectAnswers());

      expect(bobPosttest.statusCode).toBe(409);
      expect(JSON.parse(bobPosttest.body).code).toBe("PHASE_CLOSED_FOR_SUBMISSIONS");
    });

    it("compares each participant's Posttest report against their own Pretest", async () => {
      const { alice, bob, submit, advanceToPosttest } = setUpTwoParticipants(makePretestSession());

      await submit(alice.participantId, "pretest", makeAllIdkAnswers());
      await submit(bob.participantId, "pretest", makeAllWrongGuessAnswers());
      await advanceToPosttest();
      const alicePosttest = await submit(alice.participantId, "posttest", makeAllCorrectAnswers());
      const bobPosttest = await submit(bob.participantId, "posttest", makeAllCorrectAnswers());

      expect(alicePosttest.statusCode).toBe(201);
      expect(bobPosttest.statusCode).toBe(201);
      const aliceBody = JSON.parse(alicePosttest.body) as PosttestSubmissionResult;
      const bobBody = JSON.parse(bobPosttest.body) as PosttestSubmissionResult;

      // Alice: all "I don't know" before, all correct after.
      expect(aliceBody.report.pretest?.iDontKnowCount).toBe(10);
      expect(aliceBody.report.pretest?.wrongGuessCount).toBe(0);
      expect(aliceBody.report.guessingReductionDelta).toBe(0);
      expect(aliceBody.answerKeyReview[0]!.pretestChoice).toBe("I_DONT_KNOW");

      // Bob: all wrong guesses before (dm-mcq-01 answered 1), all correct after.
      expect(bobBody.report.pretest?.wrongGuessCount).toBe(10);
      expect(bobBody.report.pretest?.iDontKnowCount).toBe(0);
      expect(bobBody.report.guessingReductionDelta).toBe(100);
      expect(bobBody.answerKeyReview[0]!.pretestChoice).toBe(1);
    });
  });

  describe("authorization", () => {
    it("returns 401 without token", async () => {
      const session = makePretestSession();
      session.addParticipant("Rachel");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        {}, // No authorization header
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(401);
    });

    it("returns 403 for instructor token", async () => {
      const session = makePretestSession();
      session.addParticipant("Steve");
      const sessionRepo = new InMemoryGameSessionRepository([session]);
      const packRepo = new InMemoryCurriculumPackRepository();
      const tokenAdapter = new FakeCapabilityTokenAdapter();

      const token = await tokenAdapter.signToken({
        role: "instructor",
        sessionId: session.sessionId.value,
      });

      const handler = createSubmitAssessmentHandler({
        sessionRepo,
        packRepo,
        tokenVerifier: tokenAdapter,
      });

      const event = makeEvent(
        session.sessionId.value,
        "pretest",
        { answers: makeAllIdkAnswers() },
        { authorization: `Bearer ${token}` },
      );

      const response = await handler(event, {} as never);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("FORBIDDEN_ROLE");
    });
  });
});
