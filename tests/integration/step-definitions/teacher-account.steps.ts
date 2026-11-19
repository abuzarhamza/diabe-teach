import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { signInInstructor, signUpInstructor } from "../support/http-client.js";

interface AccountTokenResponse {
  readonly accountId: string;
  readonly email: string;
  readonly accountToken: string;
  readonly expiresAt: string;
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
      this.signedUpAccountId = (this.lastResponseBody as AccountTokenResponse).accountId;
    }
  },
);

When(
  "the teacher signs in with the password {string}",
  async function (this: TestWorld, password: string) {
    this.lastResponse = await signInInstructor({ email: this.teacherEmail!, password });
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
