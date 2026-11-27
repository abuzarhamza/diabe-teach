import type { TestWorld } from "../support/world.js";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { endSession, extendPhase, getSession, leaveSession, transitionPhase } from "../support/http-client.js";

/** Seconds a Chain-Mapping phase still accepts chains after `phaseEndsAt`. */
const SUBMISSION_GRACE_PERIOD_SEC = 5;

When(
  "the instructor advances the phase",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await transitionPhase(
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
      this.currentSessionId,
      this.instructorToken,
      { action: "jump", targetPhase },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor attempts to jump without a targetPhase",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await transitionPhase(
      this.currentSessionId,
      this.instructorToken,
      { action: "jump" },
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
      this.currentSessionId,
      token,
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor extends the phase by {int} seconds",
  async function (this: TestWorld, seconds: number) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await extendPhase(
      this.currentSessionId,
      this.instructorToken,
      { seconds },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor ends the session",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await endSession(this.currentSessionId, this.instructorToken);
    this.parseLastResponse();
  },
);

When(
  "participant {string} leaves the session",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }
    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await leaveSession(this.currentSessionId, token);
    this.parseLastResponse();
  },
);

When(
  "the instructor attempts to leave the session",
  async function (this: TestWorld) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await leaveSession(this.currentSessionId, this.instructorToken);
    this.parseLastResponse();
  },
);

When(
  "the current phase's submission window has run out",
  async function (this: TestWorld) {
    const body = this.lastResponseBody as { state?: { phaseEndsAt?: string | null } };
    const phaseEndsAt = body.state?.phaseEndsAt;
    if (!phaseEndsAt) {
      throw new Error("The last response has no phase deadline.");
    }
    const closesAtMs = Date.parse(phaseEndsAt) + SUBMISSION_GRACE_PERIOD_SEC * 1000;
    const waitMs = closesAtMs - Date.now() + 500;
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  },
);

Then(
  "the current phase should end at least {int} seconds from now",
  function (this: TestWorld, seconds: number) {
    const body = this.lastResponseBody as { state?: { phaseEndsAt?: string | null } };
    const phaseEndsAt = body.state?.phaseEndsAt;
    expect(phaseEndsAt, "phaseEndsAt").to.be.a("string");
    // Allow a few seconds for the request and clock skew between test and server.
    expect(Date.parse(phaseEndsAt!) - Date.now()).to.be.greaterThan((seconds - 5) * 1000);
  },
);
