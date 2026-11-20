import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { When } from "@cucumber/cucumber";
import { HmacCapabilityTokenAdapter } from "../../../src/adapters/outbound/hmac-capability-token-adapter.js";
import {
  archivePack,
  createSession,
  getPackById,
  getSession,
  getStandings,
  listRoundChains,
} from "../support/http-client.js";
import { localCapabilityTokenSecret } from "../support/test-config-loader.js";

/**
 * Steps that check a route's real 403 or 404 through `netlify dev`, which
 * retries any 403/404 as `<path>.html` (api-hardening 03).
 */

When(
  "the teacher archives the pack {string}",
  async function (this: TestWorld, packId: string) {
    this.lastResponse = await archivePack(packId, this.accountToken!);
    this.parseLastResponse();
  },
);

When(
  "the teacher archives a pack that does not exist",
  async function (this: TestWorld) {
    this.lastResponse = await archivePack(`bdd-missing-${randomUUID().slice(0, 8)}`, this.accountToken!);
    this.parseLastResponse();
  },
);

When(
  "someone opens a pack that does not exist",
  async function (this: TestWorld) {
    this.lastResponse = await getPackById(`bdd-missing-${randomUUID().slice(0, 8)}`);
    this.parseLastResponse();
  },
);

When(
  "an instructor opens the state of a session that does not exist",
  async function (this: TestWorld) {
    // A valid token for the missing session, so the request reaches the lookup.
    const secret = localCapabilityTokenSecret();
    if (!secret) {
      throw new Error("No Capability Token secret for the local dev server.");
    }
    const sessionId = randomUUID();
    const token = await new HmacCapabilityTokenAdapter(secret).signToken({ role: "instructor", sessionId });
    this.lastResponse = await getSession(sessionId, token);
    this.parseLastResponse();
  },
);

/** The instructor token of a second classroom session, started by the same teacher. */
async function anotherSessionsInstructorToken(world: TestWorld): Promise<string> {
  const response = await createSession({
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
  }, world.accountToken!);
  if (response.statusCode !== 201) {
    throw new Error(`Starting another session failed with ${response.statusCode}: ${response.body}`);
  }
  return (JSON.parse(response.body) as { instructorToken: string }).instructorToken;
}

When(
  "the instructor of another session retrieves standings for round {int}",
  async function (this: TestWorld, roundNumber: number) {
    const token = await anotherSessionsInstructorToken(this);
    this.lastResponse = await getStandings(this.currentSessionId!, roundNumber, token);
    this.parseLastResponse();
  },
);

When(
  "the instructor of another session lists the chains of round {int}",
  async function (this: TestWorld, roundNumber: number) {
    const token = await anotherSessionsInstructorToken(this);
    this.lastResponse = await listRoundChains(this.currentSessionId!, roundNumber, token);
    this.parseLastResponse();
  },
);
