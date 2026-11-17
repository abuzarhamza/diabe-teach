import type { TestWorld } from "../support/world.js";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { submitSurvey, transitionPhase } from "../support/http-client.js";

/**
 * Default perception survey responses for testing.
 * Uses actual survey item IDs from the diabe-teach curriculum pack's perceptionSurvey.
 * All responses use valid Likert scale values (1-5).
 */
function getDefaultSurveyResponses(): Record<string, 1 | 2 | 3 | 4 | 5> {
  return {
    "survey-q1": 4,
    "survey-q2": 5,
    "survey-q3": 4,
    "survey-q4": 3,
    "survey-q5": 4,
    "survey-q6": 5,
    "survey-q7": 3,
    "survey-q8": 4,
    "survey-q9": 5,
  };
}

When(
  "the instructor advances to the feedback-survey phase",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    // Phase sequence: pretest -> trial-orientation -> round-1:chain-mapping ->
    // round-1:peer-adjudication -> round-1:round-summary -> round-2:chain-mapping ->
    // round-2:peer-adjudication -> round-2:round-summary -> posttest -> feedback-survey
    // That's 9 advances from pretest to feedback-survey
    const phasesToFeedbackSurvey = 9;

    for (let i = 0; i < phasesToFeedbackSurvey; i++) {
      this.lastResponse = await transitionPhase(
        this.currentSessionId,
        this.instructorToken,
        { action: "advance" },
      );
      // Only parse final response
      if (i === phasesToFeedbackSurvey - 1) {
        this.parseLastResponse();
      }
    }
  },
);

When(
  "participant {string} submits a perception survey",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const responses = getDefaultSurveyResponses();

    this.lastResponse = await submitSurvey(
      this.currentSessionId,
      token,
      responses,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits a perception survey with comments {string}",
  async function (this: TestWorld, displayName: string, comments: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const responses = getDefaultSurveyResponses();

    this.lastResponse = await submitSurvey(
      this.currentSessionId,
      token,
      responses,
      comments,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits a perception survey again",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    const responses = getDefaultSurveyResponses();

    this.lastResponse = await submitSurvey(
      this.currentSessionId,
      token,
      responses,
    );
    this.parseLastResponse();
  },
);

Then(
  "the response should contain recordedItemCount",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { recordedItemCount?: number };
    expect(body.recordedItemCount).to.be.a("number");
    expect(body.recordedItemCount).to.be.greaterThan(0);
  },
);
