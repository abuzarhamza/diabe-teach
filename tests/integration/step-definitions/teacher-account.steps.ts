import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { getCurrentAccount, signInInstructor, signUpInstructor } from "../support/http-client.js";

interface AccountTokenResponse {
  readonly accountId: string;
  readonly email: string;
  readonly accountToken: string;
  readonly expiresAt: string;
}

interface CurrentAccountResponse {
  readonly accountId: string;
  readonly email: string;
  readonly createdAt: string;
}

Given("a teacher with a new email address", function (this: TestWorld) {
  // The dev server's database outlives a run, so every scenario needs its own email.
  this.teacherEmail = `teacher-${randomUUID()}@example.edu`;
});

When(
  "the teacher signs up with the password {string}",
  async function (this: TestWorld, password: string) {
    this.lastResponse = await signUpInstructor({ email: this.teacherEmail!, password });
    this.parseLastResponse();
    if (this.lastResponse.statusCode === 201) {
      const body = this.lastResponseBody as AccountTokenResponse;
      this.signedUpAccountId = body.accountId;
      this.accountToken = body.accountToken;
    }
  },
);

When(
  "the teacher signs up with email {string} and the password {string}",
  async function (this: TestWorld, email: string, password: string) {
    this.lastResponse = await signUpInstructor({ email, password });
    this.parseLastResponse();
  },
);

When(
  "the teacher signs up again with their email in uppercase with surrounding spaces and the password {string}",
  async function (this: TestWorld, password: string) {
    this.lastResponse = await signUpInstructor({
      email: `  ${this.teacherEmail!.toUpperCase()}  `,
      password,
    });
    this.parseLastResponse();
  },
);

When(
  "the teacher signs in with the password {string}",
  async function (this: TestWorld, password: string) {
    this.lastResponse = await signInInstructor({ email: this.teacherEmail!, password });
    this.parseLastResponse();
    if (this.lastResponse.statusCode === 200) {
      this.accountToken = (this.lastResponseBody as AccountTokenResponse).accountToken;
    }
  },
);

When(
  "someone who has not signed in checks their current account",
  async function (this: TestWorld) {
    this.lastResponse = await getCurrentAccount();
    this.parseLastResponse();
  },
);

When(
  "the teacher checks their current account",
  async function (this: TestWorld) {
    this.lastResponse = await getCurrentAccount(this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "the teacher checks their current account using the session's instructorToken",
  async function (this: TestWorld) {
    this.lastResponse = await getCurrentAccount(this.instructorToken!);
    this.parseLastResponse();
  },
);

Then(
  "the response should contain an Account Token for the teacher's email",
  function (this: TestWorld) {
    const body = this.lastResponseBody as AccountTokenResponse;
    expect(body.email).to.equal(this.teacherEmail);
    expect(body.accountToken).to.be.a("string").and.not.equal("");
    expect(body.accountId).to.be.a("string").and.not.equal("");
  },
);

Then(
  "the signed-in account should be the one created at sign-up",
  function (this: TestWorld) {
    expect((this.lastResponseBody as AccountTokenResponse).accountId).to.equal(this.signedUpAccountId);
  },
);

Then(
  "the current account response should match the signed-up teacher",
  function (this: TestWorld) {
    const body = this.lastResponseBody as CurrentAccountResponse;
    expect(body.accountId).to.equal(this.signedUpAccountId);
    expect(body.email).to.equal(this.teacherEmail);
    expect(body.createdAt).to.be.a("string").and.not.equal("");
    expect(Number.isNaN(Date.parse(body.createdAt))).to.equal(false);
  },
);

Then(
  "the error details should include a lockedUntil timestamp",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { details?: { lockedUntil?: string } };
    expect(body.details?.lockedUntil).to.be.a("string").and.not.equal("");
    expect(Number.isNaN(Date.parse(body.details?.lockedUntil ?? ""))).to.equal(false);
  },
);
