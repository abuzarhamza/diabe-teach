import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { Given, When } from "@cucumber/cucumber";
import { createSession, joinSession, signUpInstructor } from "../support/http-client.js";

Given(
  "the curriculum pack {string} is available",
  async function (this: TestWorld, _packId: string) {
    // The pack is pre-loaded in the Netlify dev server
    // via InMemoryCurriculumPackRepository with DIABE_TEACH_PACK
  },
);

/**
 * The scenario's Account Token. Starting a classroom game needs a signed-in
 * teacher, so a scenario that hasn't signed in signs up a fresh teacher here.
 */
async function signedInTeacherToken(world: TestWorld): Promise<string> {
  if (world.accountToken) {
    return world.accountToken;
  }
  // The dev server's database outlives a run, so every teacher needs its own email.
  world.teacherEmail ??= `teacher-${randomUUID()}@example.edu`;
  const response = await signUpInstructor({ email: world.teacherEmail, password: "correct horse battery" });
  if (response.statusCode !== 201) {
    throw new Error(`Signing up the scenario's teacher failed with ${response.statusCode}: ${response.body}`);
  }
  world.accountToken = (JSON.parse(response.body) as { accountToken: string }).accountToken;
  return world.accountToken;
}

async function createClassroomSession(
  world: TestWorld,
  packId: string,
  timerConfig?: Record<string, number | null>,
): Promise<void> {
  world.lastResponse = await createSession({
    packId,
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    timerConfig,
  }, await signedInTeacherToken(world));
  world.parseLastResponse();

  if (world.lastResponse.statusCode === 201) {
    const body = world.lastResponseBody as {
      sessionId: string;
      roomCode: string;
      instructorToken: string;
    };
    world.currentSessionId = body.sessionId;
    world.roomCode = body.roomCode;
    world.instructorToken = body.instructorToken;
  }
}

When(
  "the instructor creates a classroom session with pack {string}",
  async function (this: TestWorld, packId: string) {
    await createClassroomSession(this, packId);
  },
);

When(
  "the instructor creates a classroom session with pack {string} and an instructor-driven chain-mapping phase",
  async function (this: TestWorld, packId: string) {
    await createClassroomSession(this, packId, { roundMappingSec: null });
  },
);

When(
  "someone who has not signed in tries to create a classroom session with pack {string}",
  async function (this: TestWorld, packId: string) {
    this.lastResponse = await createSession({
      packId,
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    this.parseLastResponse();
  },
);

When(
  "the instructor creates a solo session with pack {string} as {string}",
  async function (this: TestWorld, packId: string, displayName: string) {
    this.lastResponse = await createSession({
      packId,
      mode: "solo",
      adjudicationMode: "ai",
      creatorDisplayName: displayName,
    });
    this.parseLastResponse();

    if (this.lastResponse.statusCode === 201) {
      const body = this.lastResponseBody as {
        sessionId: string;
        roomCode: string;
        instructorToken: string;
        participantId: string | null;
        participantToken: string | null;
      };
      this.currentSessionId = body.sessionId;
      this.roomCode = body.roomCode;
      this.instructorToken = body.instructorToken;

      if (body.participantId && body.participantToken) {
        this.participantIds.set(displayName, body.participantId);
        this.participantTokens.set(displayName, body.participantToken);
      }
    }
  },
);

When(
  "participant {string} joins using the room code",
  async function (this: TestWorld, displayName: string) {
    if (!this.roomCode) {
      throw new Error("No room code available. Create a session first.");
    }

    this.lastResponse = await joinSession({
      roomCode: this.roomCode,
      displayName,
    });
    this.parseLastResponse();

    if (this.lastResponse.statusCode === 200) {
      const body = this.lastResponseBody as {
        participantId: string;
        participantToken: string;
      };
      this.participantIds.set(displayName, body.participantId);
      this.participantTokens.set(displayName, body.participantToken);
    }
  },
);

When(
  "participants {string} and {string} join using the room code",
  async function (this: TestWorld, name1: string, name2: string) {
    if (!this.roomCode) {
      throw new Error("No room code available. Create a session first.");
    }

    // Join first participant
    let response = await joinSession({
      roomCode: this.roomCode,
      displayName: name1,
    });

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body) as {
        participantId: string;
        participantToken: string;
      };
      this.participantIds.set(name1, body.participantId);
      this.participantTokens.set(name1, body.participantToken);
    }

    // Join second participant
    response = await joinSession({
      roomCode: this.roomCode,
      displayName: name2,
    });
    this.lastResponse = response;
    this.parseLastResponse();

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body) as {
        participantId: string;
        participantToken: string;
      };
      this.participantIds.set(name2, body.participantId);
      this.participantTokens.set(name2, body.participantToken);
    }
  },
);

When(
  "someone attempts to join with invalid room code {string}",
  async function (this: TestWorld, invalidCode: string) {
    this.lastResponse = await joinSession({
      roomCode: invalidCode,
      displayName: "Unknown",
    });
    this.parseLastResponse();
  },
);
