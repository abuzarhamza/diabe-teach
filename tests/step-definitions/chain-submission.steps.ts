import type { TestWorld } from "../support/world.js";
import { When } from "@cucumber/cucumber";
import { adjudicateChain, getStandings, submitChain } from "../support/http-client.js";

When(
  "participant {string} submits a concept chain for round {int}",
  async function (this: TestWorld, displayName: string, roundNumber: number) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await submitChain(
      this.deps,
      this.currentSessionId,
      roundNumber,
      token,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: `${displayName}'s chain explanation connecting concepts in diabetes management.`,
      },
    );
    this.parseLastResponse();

    if (this.lastResponse.statusCode === 201) {
      const body = this.lastResponseBody as { chain: { chainId: string } };
      this.lastChainId = body.chain.chainId;
    }
  },
);

When(
  "participant {string} submits a chain with path from {string} to {string}",
  async function (
    this: TestWorld,
    displayName: string,
    startCoord: string,
    endCoord: string,
  ) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    // Parse coordinates like "0,0" to { row: 0, col: 0 }
    const parseCoord = (s: string) => {
      const [row, col] = s.split(",").map(Number);
      return { row, col };
    };

    const start = parseCoord(startCoord);
    const end = parseCoord(endCoord);

    // Generate a simple path between start and end
    const path = [start];
    let current = { ...start };

    while (current.row !== end.row || current.col !== end.col) {
      if (current.row < end.row) current.row++;
      else if (current.row > end.row) current.row--;
      else if (current.col < end.col) current.col++;
      else if (current.col > end.col) current.col--;

      path.push({ ...current });
    }

    const keywordIds = path.map((_, i) => `kw-${i + 1}`);

    this.lastResponse = await submitChain(
      this.deps,
      this.currentSessionId,
      1,
      token,
      {
        path,
        keywordIds,
        narrativeExplanation: `${displayName}'s custom chain from ${startCoord} to ${endCoord}.`,
      },
    );
    this.parseLastResponse();

    if (this.lastResponse.statusCode === 201) {
      const body = this.lastResponseBody as { chain: { chainId: string } };
      this.lastChainId = body.chain.chainId;
    }
  },
);

When(
  "participant {string} submits a chain with non-adjacent cells",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await submitChain(
      this.deps,
      this.currentSessionId,
      1,
      token,
      {
        path: [
          { row: 0, col: 0 },
          { row: 5, col: 5 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
        keywordIds: ["kw-1", "kw-2", "kw-3", "kw-4"],
        narrativeExplanation: "Invalid chain with non-adjacent cells.",
      },
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} submits a chain that is too short",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await submitChain(
      this.deps,
      this.currentSessionId,
      1,
      token,
      {
        path: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        keywordIds: ["kw-1", "kw-2"],
        narrativeExplanation: "Too short chain.",
      },
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} peer-approves the last submitted chain",
  async function (this: TestWorld, displayName: string) {
    if (!this.currentSessionId || !this.lastChainId) {
      throw new Error("No session or chain available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await adjudicateChain(
      this.deps,
      this.currentSessionId,
      1,
      this.lastChainId,
      token,
      { action: "peer-approve", comment: `Approved by ${displayName}` },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor finalizes adjudication on the last chain with score {int}",
  async function (this: TestWorld, score: number) {
    if (!this.currentSessionId || !this.instructorToken || !this.lastChainId) {
      throw new Error("No session, instructor token, or chain available.");
    }

    this.lastResponse = await adjudicateChain(
      this.deps,
      this.currentSessionId,
      1,
      this.lastChainId,
      this.instructorToken,
      {
        action: "instructor-final",
        qualityScore: score,
        feedback: "Good chain construction demonstrating understanding.",
      },
    );
    this.parseLastResponse();
  },
);

When(
  "the instructor retrieves standings for round {int}",
  async function (this: TestWorld, roundNumber: number) {
    if (!this.currentSessionId || !this.instructorToken) {
      throw new Error("No session or instructor token available.");
    }

    this.lastResponse = await getStandings(
      this.deps,
      this.currentSessionId,
      roundNumber,
      this.instructorToken,
    );
    this.parseLastResponse();
  },
);

When(
  "participant {string} retrieves standings for round {int}",
  async function (this: TestWorld, displayName: string, roundNumber: number) {
    if (!this.currentSessionId) {
      throw new Error("No session available.");
    }

    const token = this.participantTokens.get(displayName);
    if (!token) {
      throw new Error(`No token found for participant '${displayName}'.`);
    }

    this.lastResponse = await getStandings(
      this.deps,
      this.currentSessionId,
      roundNumber,
      token,
    );
    this.parseLastResponse();
  },
);
