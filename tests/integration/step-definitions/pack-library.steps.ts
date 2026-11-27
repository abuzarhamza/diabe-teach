import type { TestWorld } from "../support/world.js";
import { randomUUID } from "node:crypto";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";
import { DIABE_TEACH_PACK } from "../../../src/domain/curriculum-pack/diabe-teach-pack.js";
import {
  archivePack,
  getPackById,
  listPacks,
  postOversizedPackPayload,
  registerPack,
  unarchivePack,
  validatePack,
} from "../support/http-client.js";

/** A teacher's own pack, built from Diabe-teach's content under a new id. */
function newPackBody(packId: string, version = "1.0.0"): Record<string, unknown> {
  return {
    id: packId,
    title: "A teacher's own pack",
    version,
    description: DIABE_TEACH_PACK.description,
    boardConfig: DIABE_TEACH_PACK.boardConfig,
    domains: DIABE_TEACH_PACK.domains,
    cards: DIABE_TEACH_PACK.cards,
    adjudicationRubric: DIABE_TEACH_PACK.adjudicationRubric,
    assessmentInstrument: DIABE_TEACH_PACK.assessmentInstrument,
    perceptionSurvey: DIABE_TEACH_PACK.perceptionSurvey,
  };
}

/** An undersized draft pack with 8 cards for a 3x3 board. */
function undersizedPackBody(packId: string): Record<string, unknown> {
  return {
    ...newPackBody(packId),
    boardConfig: {
      rows: 3,
      cols: 3,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    cards: DIABE_TEACH_PACK.cards.slice(0, 8),
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
  "the teacher registers the same pack and version again",
  async function (this: TestWorld) {
    this.lastResponse = await registerPack(newPackBody(this.registeredPackId!), this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "the teacher tries to register a new pack using the session's instructorToken",
  async function (this: TestWorld) {
    const packId = `bdd-pack-${randomUUID().slice(0, 8)}`;
    this.lastResponse = await registerPack(newPackBody(packId), this.instructorToken!);
    this.parseLastResponse();
  },
);

When(
  "the teacher validates an undersized draft pack with 8 cards for a 3x3 board",
  async function (this: TestWorld) {
    const packId = `bdd-draft-${randomUUID().slice(0, 8)}`;
    this.lastResponse = await validatePack(undersizedPackBody(packId), this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "the teacher tries to register that undersized pack",
  async function (this: TestWorld) {
    const packId = `bdd-undersized-${randomUUID().slice(0, 8)}`;
    this.lastResponse = await registerPack(undersizedPackBody(packId), this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "the teacher tries to register version {string} of the System Pack {string}",
  async function (this: TestWorld, version: string, packId: string) {
    this.lastResponse = await registerPack(newPackBody(packId, version), this.accountToken ?? undefined);
    this.parseLastResponse();
  },
);

When(
  "the teacher sends a {int}-byte pack payload",
  async function (this: TestWorld, byteLength: number) {
    this.lastResponse = await postOversizedPackPayload(byteLength, this.accountToken ?? undefined);
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
  "the teacher archives the registered pack",
  async function (this: TestWorld) {
    this.lastResponse = await archivePack(this.registeredPackId!, this.accountToken!);
    this.parseLastResponse();
  },
);

When(
  "the teacher unarchives the registered pack",
  async function (this: TestWorld) {
    this.lastResponse = await unarchivePack(this.registeredPackId!, this.accountToken!);
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
  "the pack validation result should be invalid with error code {string}",
  function (this: TestWorld, expectedCode: string) {
    const body = this.lastResponseBody as {
      valid?: boolean;
      errors?: Array<{ code: string; path: string; message: string }>;
    };
    expect(body.valid).to.equal(false);
    expect(body.errors).to.be.an("array");
    const matchingError = (body.errors ?? []).find(err => err.code === expectedCode);
    expect(matchingError, `expected validation error ${expectedCode}`).to.not.equal(undefined);
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

function listedPack(world: TestWorld, packId: string): Record<string, unknown> {
  const body = world.lastResponseBody as { packs: Array<Record<string, unknown>> };
  const listed = body.packs.find(pack => pack.id === packId);
  expect(listed, `pack ${packId} should be listed`).to.not.equal(undefined);
  return listed!;
}

Then(
  "the pack {string} should be listed as a System Pack",
  function (this: TestWorld, packId: string) {
    expect(listedPack(this, packId).isSystemPack).to.equal(true);
  },
);

Then(
  "the registered pack should be listed as not a System Pack",
  function (this: TestWorld) {
    expect(listedPack(this, this.registeredPackId!).isSystemPack).to.equal(false);
  },
);

When(
  "someone opens the pack {string}",
  async function (this: TestWorld, packId: string) {
    this.lastResponse = await getPackById(packId);
    this.parseLastResponse();
  },
);

When(
  "someone opens the registered pack",
  async function (this: TestWorld) {
    this.lastResponse = await getPackById(this.registeredPackId!);
    this.parseLastResponse();
  },
);

Then(
  "the opened pack should be marked as a System Pack",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { pack: Record<string, unknown> };
    expect(body.pack.isSystemPack).to.equal(true);
  },
);

Then(
  "the opened pack should be marked as not a System Pack",
  function (this: TestWorld) {
    const body = this.lastResponseBody as { pack: Record<string, unknown> };
    expect(body.pack.isSystemPack).to.equal(false);
  },
);
