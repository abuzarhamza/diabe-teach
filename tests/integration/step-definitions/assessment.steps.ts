import type { TestWorld } from "../support/world.js";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { getSessionAnalytics, submitAssessment, transitionPhase } from "../support/http-client.js";

/**
 * Default assessment answers for testing.
 * Uses actual question IDs from the diabe-teach curriculum pack's assessmentInstrument.
 * Uses a mix of numeric choices and "I_DONT_KNOW" to exercise all code paths.
 */
function getDefaultAssessmentAnswers(): Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> {
  return {
    "dm-mcq-01": 0,
    "dm-mcq-02": 1,
    "dm-mcq-03": 2,
    "dm-mcq-04": 3,
    "dm-mcq-05": "I_DONT_KNOW",
    "dm-mcq-06": 0,
    "dm-mcq-07": 1,
    "dm-mcq-08": 2,
    "dm-mcq-09": 3,
    "dm-mcq-10": "I_DONT_KNOW",
  };
}

When(
  "participant {string} submits pretest answers",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const answers = getDefaultAssessmentAnswers();

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "pretest",
      token,
      answers,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits pretest answers again",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const answers = getDefaultAssessmentAnswers();

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "pretest",
      token,
      answers,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits posttest answers",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const answers = getDefaultAssessmentAnswers();

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "posttest",
      token,
      answers,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits an incomplete pretest assessment",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const partialAnswers: Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> = {
      "dm-mcq-01": 0,
      "dm-mcq-02": 1,
      "dm-mcq-03": 2,
      "dm-mcq-04": 3,
      "dm-mcq-05": "I_DONT_KNOW",
    };

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "pretest",
      token,
      partialAnswers,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits a pretest assessment with invalid answer choice {int} for question {string}",
  async function (this: TestWorld, displayName: string, invalidChoice: number, questionId: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const answers: Record<string, unknown> = {
      ...getDefaultAssessmentAnswers(),
      [questionId]: invalidChoice,
    };

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "pretest",
      token,
      answers as Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW">,
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor attempts to submit pretest answers",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    const answers = getDefaultAssessmentAnswers();

    this.lastResponse = await submitAssessment(
      this.currentSessionId,
      "pretest",
      this.instructorToken,
      answers,
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor advances to the posttest phase",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    // Phase sequence: pretest → trial-orientation → round-1:chain-mapping →
    // round-1:peer-adjudication → round-1:round-summary → round-2:chain-mapping →
    // round-2:peer-adjudication → round-2:round-summary → posttest
    // That's 8 advances from pretest to posttest
    const phasesToPosttest = 8;

    for (let i = 0; i < phasesToPosttest; i++) {
      this.lastResponse = await transitionPhase(
        this.currentSessionId,
        this.instructorToken,
        { action: "advance" },
      );
      // Only parse final response
      if (i === phasesToPosttest - 1) {
        this.parseLastResponse();
      }
    }
  },
);

Then(
  "the response should contain stage {string}",
  function (this: TestWorld, expectedStage: string) {
    const body = this.lastResponseBody as { stage?: string };
    expect(body.stage).to.equal(expectedStage);
  },
);

Then(
  "the response should contain recordedCount",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { recordedCount?: number };
    expect(body.recordedCount).to.be.a("number");
    expect(body.recordedCount).to.be.greaterThan(0);
  },
);

Then(
  "the response should contain submittedAt",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { submittedAt?: string };
    expect(body.submittedAt).to.be.a("string");
    // Verify it's a valid ISO date string
    const date = new Date(body.submittedAt!);
    expect(date.getTime()).to.not.be.NaN;
  },
);

Then(
  "the response should not contain graded results",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      report?: unknown;
      answerKeyReview?: unknown;
      correctPercentage?: unknown;
    };
    // Pretest responses should not reveal grades
    expect(body.report).to.be.undefined;
    expect(body.answerKeyReview).to.be.undefined;
    expect(body.correctPercentage).to.be.undefined;
  },
);

Then(
  "the response should contain a metacognitive report",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      report?: {
        participantId?: string;
        pretest?: {
          stage: string;
          totalQuestions: number;
          correctCount: number;
          wrongGuessCount: number;
          iDontKnowCount: number;
          correctPercentage: number;
          wrongGuessPercentage: number;
          iDontKnowPercentage: number;
          uncertaintyCalibrationRatio: number;
        } | null;
        posttest?: {
          stage: string;
          totalQuestions: number;
          correctCount: number;
          wrongGuessCount: number;
          iDontKnowCount: number;
          correctPercentage: number;
          wrongGuessPercentage: number;
          iDontKnowPercentage: number;
          uncertaintyCalibrationRatio: number;
        } | null;
        knowledgeGainDelta?: number | null;
        guessingReductionDelta?: number | null;
        chainDiversityIndex?: number;
        neglectedKeywordIds?: string[];
      };
    };
    expect(body.report).to.be.an("object");
    expect(body.report?.participantId).to.be.a("string");
    expect(body.report?.posttest).to.be.an("object");
    expect(body.report?.posttest?.stage).to.equal("posttest");
    expect(body.report?.posttest?.totalQuestions).to.be.a("number");
    expect(body.report?.posttest?.correctPercentage).to.be.a("number");
    expect(body.report?.posttest?.uncertaintyCalibrationRatio).to.be.a("number");
    expect(body.report?.chainDiversityIndex).to.be.a("number");
    expect(body.report?.neglectedKeywordIds).to.be.an("array");
  },
);

Then(
  "the response should contain answer key review",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      answerKeyReview?: Array<{
        questionId: string;
        stem: string;
        options: [string, string, string, string];
        correctIndex: 0 | 1 | 2 | 3;
        explanation: string | null;
        pretestChoice: number | "I_DONT_KNOW" | null;
        posttestChoice: number | "I_DONT_KNOW";
      }>;
    };
    expect(body.answerKeyReview).to.be.an("array");
    expect(body.answerKeyReview!.length).to.be.greaterThan(0);

    const firstItem = body.answerKeyReview![0];
    expect(firstItem).to.have.property("questionId");
    expect(firstItem).to.have.property("stem");
    expect(firstItem).to.have.property("options");
    expect(firstItem).to.have.property("correctIndex");
    expect(firstItem).to.have.property("posttestChoice");
  },
);

Then(
  "the metacognitive report should include a pretest summary",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      report?: { pretest?: { stage?: string } | null };
    };
    expect(body.report?.pretest?.stage).to.equal("pretest");
  },
);

When(
  "participant {string} fetches their analytics report",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }
    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await getSessionAnalytics(this.currentSessionId, token);
    this.parseLastResponse();
  },
);

Then(
  "the analytics report should show their pretest and posttest results",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      role?: string;
      participantReport?: {
        participantId?: string;
        pretest?: { stage?: string; correctPercentage?: number } | null;
        posttest?: { stage?: string; correctPercentage?: number } | null;
        knowledgeGainDelta?: number | null;
        guessingReductionDelta?: number | null;
        chainDiversityIndex?: number;
        neglectedKeywordIds?: string[];
      };
      cohortSummary?: { sessionId?: string; participantCount?: number };
    };
    expect(body.role).to.equal("participant");
    const report = body.participantReport;
    expect(report?.participantId).to.be.a("string");
    expect(report?.pretest?.stage).to.equal("pretest");
    expect(report?.posttest?.stage).to.equal("posttest");
    // The default answers are the same at both stages, so nothing changed.
    expect(report?.knowledgeGainDelta).to.equal(0);
    expect(report?.guessingReductionDelta).to.equal(0);
    expect(report?.chainDiversityIndex).to.equal(0);
    expect(report?.neglectedKeywordIds).to.be.an("array");
    expect(body.cohortSummary?.sessionId).to.equal(this.currentSessionId);
    expect(body.cohortSummary?.participantCount).to.equal(1);
  },
);
