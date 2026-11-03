import type { TestWorld } from "../support/world.js";
import { When } from "@cucumber/cucumber";
import { getSession, transitionPhase } from "../support/http-client.js";

When(
  "the instructor advances the phase",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await transitionPhase(
      this.deps,
      this.currentSessionId,
      this.instructorToken,
      { action: "advance" },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor advances the phase {int} times",
  async function (this: TestWorld, times: number) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    for (let i = 0; i < times; i++) {
      this.lastResponse = await transitionPhase(
        this.deps,
        this.currentSessionId,
        this.instructorToken,
        { action: "advance" },
      );
      this.parseLastResponse();

      if (this.lastResponse.statusCode !== 200) {
        break;
      }
    }
  },
);

When(
  "the instructor jumps to phase {string}",
  async function (this: TestWorld, targetPhase: string) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await transitionPhase(
      this.deps,
      this.currentSessionId,
      this.instructorToken,
      { action: "jump", targetPhase },
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} attempts to advance the phase",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await transitionPhase(
      this.deps,
      this.currentSessionId,
      token,
      { action: "advance" },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor retrieves the session state",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await getSession(
      this.deps,
      this.currentSessionId,
      this.instructorToken,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} retrieves the session state",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await getSession(
      this.deps,
      this.currentSessionId,
      token,
    );
    this.parseLastResponse();
  },
);
