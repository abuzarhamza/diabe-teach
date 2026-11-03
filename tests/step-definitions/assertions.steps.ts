import type { TestWorld } from "../support/world.js";
import { Then } from "@cucumber/cucumber";
import { expect } from "chai";

Then(
  "the response status should be {int}",
  function (this: TestWorld, expectedStatus: number) {
    expect(this.lastResponse?.statusCode).to.equal(expectedStatus);
  },
);

Then(
  "the response should contain a 6-character roomCode",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { roomCode?: string };
    expect(body.roomCode).to.match(/^[A-Z0-9]{6}$/);
  },
);

Then(
  "the response should contain sessionId",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { sessionId?: string };
    expect(body.sessionId).to.be.a("string");
    expect(body.sessionId!.length).to.be.greaterThan(0);
  },
);

Then(
  "the response should contain instructorToken",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { instructorToken?: string };
    expect(body.instructorToken).to.be.a("string");
    expect(body.instructorToken!.length).to.be.greaterThan(0);
  },
);

Then(
  "the response should contain participantToken",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { participantToken?: string };
    expect(body.participantToken).to.be.a("string");
    expect(body.participantToken!.length).to.be.greaterThan(0);
  },
);

Then(
  "the response should contain participantId",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { participantId?: string };
    expect(body.participantId).to.be.a("string");
    expect(body.participantId!.length).to.be.greaterThan(0);
  },
);

Then(
  "the session phase should be {string}",
  function (this: TestWorld, expectedPhase: string) {
    const body = this.lastResponseBody as {
      state?: { currentPhase?: string };
      session?: { currentPhase?: string };
    };
    const phase = body.state?.currentPhase ?? body.session?.currentPhase;
    expect(phase).to.equal(expectedPhase);
  },
);

Then(
  "the participant count should be {int}",
  function (this: TestWorld, expectedCount: number) {
    const body = this.lastResponseBody as {
      state?: { participantCount?: number };
    };
    expect(body.state?.participantCount).to.equal(expectedCount);
  },
);

Then(
  "the response error code should be {string}",
  function (this: TestWorld, expectedCode: string) {
    const body = this.lastResponseBody as { code?: string };
    expect(body.code).to.equal(expectedCode);
  },
);

Then(
  "the response should contain a chain with status {string}",
  function (this: TestWorld, expectedStatus: string) {
    const body = this.lastResponseBody as { chain?: { status?: string } };
    expect(body.chain?.status).to.equal(expectedStatus);
  },
);

Then(
  "the response should contain a chainId",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { chain?: { chainId?: string } };
    expect(body.chain?.chainId).to.be.a("string");
    expect(body.chain?.chainId!.length).to.be.greaterThan(0);
  },
);

Then(
  "the chain length should be {int}",
  function (this: TestWorld, expectedLength: number) {
    const body = this.lastResponseBody as { chain?: { chainLength?: number } };
    expect(body.chain?.chainLength).to.equal(expectedLength);
  },
);

Then(
  "the session should have {int} participant(s)",
  function (this: TestWorld, count: number) {
    const body = this.lastResponseBody as {
      state?: { participantCount?: number };
      session?: { participantCount?: number };
    };
    const participantCount
      = body.state?.participantCount ?? body.session?.participantCount;
    expect(participantCount).to.equal(count);
  },
);

Then(
  "the solo participant should be auto-joined",
  function (this: TestWorld) {
    const body = this.lastResponseBody as {
      participantId?: string | null;
      participantToken?: string | null;
      state?: { participantCount?: number };
    };
    expect(body.participantId).to.be.a("string");
    expect(body.participantToken).to.be.a("string");
    expect(body.state?.participantCount).to.equal(1);
  },
);

Then(
  "the response should contain standings",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { standings?: unknown };
    expect(body.standings).to.exist;
  },
);

Then(
  "the active round number should be {int}",
  function (this: TestWorld, expectedRound: number) {
    const body = this.lastResponseBody as {
      state?: { activeRoundNumber?: number };
      session?: { activeRoundNumber?: number };
    };
    const roundNumber
      = body.state?.activeRoundNumber ?? body.session?.activeRoundNumber;
    expect(roundNumber).to.equal(expectedRound);
  },
);

Then(
  "the chain should be finalized with score {int}",
  function (this: TestWorld, expectedScore: number) {
    const body = this.lastResponseBody as {
      chain?: { qualityScore?: number; status?: string };
    };
    expect(body.chain?.qualityScore).to.equal(expectedScore);
    expect(body.chain?.status).to.equal("instructor-finalized");
  },
);
