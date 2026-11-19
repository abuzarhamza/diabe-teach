import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { DIABE_TEACH_PACK } from "../../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { listPacks, registerPack } from "../support/http-client.js";

/** A teacher's own pack, built from Diabe-teach's content under a new id. */
function newPackBody(packId: string): Record<string, unknown> {
  return {
    id: packId,
    title: "A teacher's own pack",
    version: "1.0.0",
    description: DIABE_TEACH_PACK.description,
    boardConfig: DIABE_TEACH_PACK.boardConfig,
    domains: DIABE_TEACH_PACK.domains,
    cards: DIABE_TEACH_PACK.cards,
    adjudicationRubric: DIABE_TEACH_PACK.adjudicationRubric,
    assessmentInstrument: DIABE_TEACH_PACK.assessmentInstrument,
    perceptionSurvey: DIABE_TEACH_PACK.perceptionSurvey,
  };
}

When(
  "the teacher registers a new pack",
  async function (this: TestWorld) {
    // The dev server's database outlives a run, so every scenario needs its own pack id.
    this.registeredPackId = `bdd-pack-${randomUUID().slice(0, 8)}`;
    this.lastResponse = await registerPack(newPackBody(this.registeredPackId), this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "someone who has not signed in tries to register a new pack",
  async function (this: TestWorld) {
    this.registeredPackId = `bdd-pack-${randomUUID().slice(0, 8)}`;
    this.lastResponse = await registerPack(newPackBody(this.registeredPackId));
    this.parseLastResponse();
  },
);

When(
  "the teacher lists the packs",
  async function (this: TestWorld) {
    this.lastResponse = await listPacks();
    this.parseLastResponse();
  },
);

Then(
  "the registered pack should be listed with the teacher's author handle and version {string}",
  function (this: TestWorld, version: string) {
    const body = this.lastResponseBody as { packs: Array<Record<string, unknown>> };
    const listed = body.packs.find(pack => pack.id === this.registeredPackId);
    expect(listed, `pack ${this.registeredPackId} should be listed`).to.not.equal(undefined);
    // The handle is the email before the @, and the full email never appears.
    const handle = this.teacherEmail!.slice(0, this.teacherEmail!.indexOf("@"));
    expect(listed!.authorHandle).to.equal(handle);
    expect(listed!.version).to.equal(version);
    expect(listed!.isArchived).to.equal(false);
    expect(JSON.stringify(body)).to.not.include(this.teacherEmail!);
  },
);
