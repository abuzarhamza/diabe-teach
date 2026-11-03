import type { TestWorld } from "../support/world.js";
import { Given, When } from "@cucumber/cucumber";
import { createSession, joinSession } from "../support/http-client.js";

Given(
  "the curriculum pack {string} is available",
  async function (this: TestWorld, _packId: string) {
    // The pack is pre-loaded by the Before hook via InMemoryCurriculumPackRepository
    // with DIABE_TEACH_PACK which has id "diabe-teach"
  },
);

When(
  "the instructor creates a classroom session with pack {string}",
  async function (this: TestWorld, packId: string) {
    this.lastResponse = await createSession(this.deps, {
      packId,
      mode: "classroom",
      adjudicationMode: "peer-instructor",
    });
    this.parseLastResponse();

    if (this.lastResponse.statusCode === 201) {
      const body = this.lastResponseBody as {
        sessionId: string;
        roomCode: string;
        instructorToken: string;
      };
      this.currentSessionId = body.sessionId;
      this.roomCode = body.roomCode;
      this.instructorToken = body.instructorToken;
    }
  },
);

When(
  "the instructor creates a solo session with pack {string} as {string}",
  async function (this: TestWorld, packId: string, displayName: string) {
    this.lastResponse = await createSession(this.deps, {
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

    this.lastResponse = await joinSession(this.deps, {
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
    let response = await joinSession(this.deps, {
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
    response = await joinSession(this.deps, {
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
    this.lastResponse = await joinSession(this.deps, {
      roomCode: invalidCode,
      displayName: "Unknown",
    });
    this.parseLastResponse();
  },
);
