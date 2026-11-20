import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ClockPort } from "../../src/application/ports/clock.port.js";
import { describe, expect, it } from "vitest";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { createListPacksHandler } from "../../netlify/functions/packs/list-packs.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { createUnarchivePackHandler } from "../../netlify/functions/packs/unarchive-pack.js";
import { createValidatePackHandler } from "../../netlify/functions/packs/validate-pack.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { PackId } from "../../src/domain/curriculum-pack/pack-id.js";
import { OTHER_TEACHER, SignedInTeachers, TEST_TEACHER } from "./support/signed-in-teacher.js";

/**
 * The shared Curriculum Pack library (ADR-0007): the pack routes take a
 * teacher's Account Token, need no Game Session, and let any signed-in
 * teacher version, archive or unarchive any non-system pack.
 */

const API_KEY = "test-api-key";
const PACK_ID = "shared-pack";

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;

function packBody(version = "1.0.0", id = PACK_ID, title = `Shared Pack ${version}`): Record<string, unknown> {
  return {
    id,
    title,
    version,
    description: "A pack in the shared library.",
    boardConfig: {
      rows: 3,
      cols: 3,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      { id: "domain-1", label: "Domain 1", description: "First domain" },
    ],
    cards: Array.from({ length: 9 }, (_, index) => ({
      id: `card-${index + 1}`,
      verbatimLabel: `Card ${index + 1}`,
      displayLabel: `Card ${index + 1}`,
      aliases: [],
      domainId: "domain-1",
      summary: `Card number ${index + 1}`,
    })),
    adjudicationRubric: {
      evaluatorPersona: "Test Evaluator",
      subjectDomain: "Testing",
      chainContinuityCriteria: ["Criterion 1"],
      calibrationExamples: [],
    },
    assessmentInstrument: null,
    perceptionSurvey: null,
  };
}

class FixedClock implements ClockPort {
  #now: Date;

  public constructor(iso: string) {
    this.#now = new Date(iso);
  }

  public now(): Date {
    return new Date(this.#now);
  }

  public set(iso: string): void {
    this.#now = new Date(iso);
  }
}

function makeEvent(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; packId?: string } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    body: options.body === undefined
      ? null
      : JSON.stringify(options.body),
    isBase64Encoded: false,
    pathParameters: options.packId
      ? { packId: options.packId }
      : null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

async function invoke(handler: Handler, event: APIGatewayProxyEvent) {
  const response = await handler(event, {} as never) as APIGatewayProxyResult;
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body) as Record<string, any>,
  };
}

/** A library with no Game Sessions at all: only packs, teachers and a clock. */
function library(initialPacks = [DIABE_TEACH_PACK]) {
  const packRepo = new InMemoryCurriculumPackRepository(initialPacks);
  const teachers = new SignedInTeachers();
  const clock = new FixedClock("2026-11-19T09:00:00.000Z");
  const deps = {
    packRepo,
    accountTokenVerifier: teachers.verifier,
    clock,
    apiKey: API_KEY,
    requireApiKey: true,
  };
  const handlers = {
    validate: createValidatePackHandler(deps) as Handler,
    register: createRegisterPackHandler(deps) as Handler,
    archive: createArchivePackHandler(deps) as Handler,
    unarchive: createUnarchivePackHandler(deps) as Handler,
    list: createListPacksHandler({ packRepo, apiKey: API_KEY, requireApiKey: true }) as Handler,
  };

  return {
    packRepo,
    teachers,
    clock,
    validate: async (token: string | undefined, body: unknown = packBody()) =>
      invoke(handlers.validate, makeEvent("POST", "/api/v1/packs/validate", { token, body })),
    register: async (token: string | undefined, body: unknown = packBody()) =>
      invoke(handlers.register, makeEvent("POST", "/api/v1/packs", { token, body })),
    archive: async (token: string | undefined, packId = PACK_ID) =>
      invoke(handlers.archive, makeEvent("POST", `/api/v1/packs/${packId}/archive`, { token, packId })),
    unarchive: async (token: string | undefined, packId = PACK_ID) =>
      invoke(handlers.unarchive, makeEvent("POST", `/api/v1/packs/${packId}/unarchive`, { token, packId })),
    listedIds: async () => {
      const listed = await invoke(handlers.list, makeEvent("GET", "/api/v1/packs"));
      return (listed.body.packs as Array<{ id: string }>).map(pack => pack.id);
    },
  };
}

async function instructorCapabilityToken(): Promise<string> {
  return new FakeCapabilityTokenAdapter().signToken({ sessionId: "instructor-session", role: "instructor" });
}

describe("shared pack library: pack routes take an Account Token", () => {
  it("validates and registers with an Account Token and no Game Session", async () => {
    const lib = library();
    const token = await lib.teachers.tokenFor(TEST_TEACHER);

    const validated = await lib.validate(token);
    expect(validated.statusCode).toBe(200);
    expect(validated.body.valid).toBe(true);

    const registered = await lib.register(token);
    expect(registered.statusCode).toBe(201);
    expect(registered.body).toMatchObject({ packId: PACK_ID, version: "1.0.0" });

    const stored = await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "1.0.0");
    expect(stored?.createdBy).toBe(TEST_TEACHER.accountId);
    expect(stored?.createdAt.toISOString()).toBe("2026-11-19T09:00:00.000Z");
  });

  it("returns 401 without a token on every pack write route", async () => {
    const lib = library();
    await lib.register(await lib.teachers.tokenFor());

    for (const response of [
      await lib.validate(undefined),
      await lib.register(undefined, packBody("2.0.0")),
      await lib.archive(undefined),
      await lib.unarchive(undefined),
    ]) {
      expect(response.statusCode).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED_TOKEN");
    }
    expect(await lib.packRepo.existsByIdAndVersion(PACK_ID, "2.0.0")).toBe(false);
  });

  it("returns 401 for an instructor Capability Token on every pack write route", async () => {
    const lib = library();
    await lib.register(await lib.teachers.tokenFor());
    const capabilityToken = await instructorCapabilityToken();

    for (const response of [
      await lib.validate(capabilityToken),
      await lib.register(capabilityToken, packBody("2.0.0")),
      await lib.archive(capabilityToken),
      await lib.unarchive(capabilityToken),
    ]) {
      expect(response.statusCode).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED_TOKEN");
    }
    expect(await lib.packRepo.existsByIdAndVersion(PACK_ID, "2.0.0")).toBe(false);
  });
});

describe("shared pack library: any teacher can version, archive and unarchive any pack", () => {
  it("lets teacher B release v2 of teacher A's pack, leaving v1 unchanged", async () => {
    const lib = library();
    expect((await lib.register(await lib.teachers.tokenFor(TEST_TEACHER), packBody("1.0.0", PACK_ID, "By A"))).statusCode).toBe(201);
    const v1Before = await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "1.0.0");

    lib.clock.set("2026-11-19T10:30:00.000Z");
    const released = await lib.register(await lib.teachers.tokenFor(OTHER_TEACHER), packBody("2.0.0", PACK_ID, "By B"));

    expect(released.statusCode).toBe(201);
    expect(released.body).toMatchObject({ packId: PACK_ID, version: "2.0.0" });
    const v1 = await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "1.0.0");
    const v2 = await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "2.0.0");
    expect(v1).toEqual(v1Before);
    expect(v1?.title).toBe("By A");
    expect(v1?.createdBy).toBe(TEST_TEACHER.accountId);
    expect(v2?.title).toBe("By B");
    expect(v2?.createdBy).toBe(OTHER_TEACHER.accountId);
    expect(v2?.createdAt.toISOString()).toBe("2026-11-19T10:30:00.000Z");
    expect((await lib.packRepo.findById(PackId.create(PACK_ID)))?.version).toBe("2.0.0");
  });

  it("lets teacher B archive and unarchive teacher A's pack, recording teacher B and the time", async () => {
    const lib = library();
    await lib.register(await lib.teachers.tokenFor(TEST_TEACHER));
    const tokenB = await lib.teachers.tokenFor(OTHER_TEACHER);

    lib.clock.set("2026-11-19T11:00:00.000Z");
    const archived = await lib.archive(tokenB);

    expect(archived.statusCode).toBe(200);
    expect(archived.body).toEqual({
      packId: PACK_ID,
      isArchived: true,
      archivedAt: "2026-11-19T11:00:00.000Z",
      archivedBy: OTHER_TEACHER.accountId,
    });
    const afterArchive = await lib.packRepo.findById(PackId.create(PACK_ID));
    expect(afterArchive?.isArchived).toBe(true);
    expect(afterArchive?.archivedBy).toBe(OTHER_TEACHER.accountId);
    expect(afterArchive?.archivedAt?.toISOString()).toBe("2026-11-19T11:00:00.000Z");
    expect(afterArchive?.createdBy).toBe(TEST_TEACHER.accountId);
    expect(await lib.listedIds()).not.toContain(PACK_ID);

    lib.clock.set("2026-11-19T11:15:00.000Z");
    const unarchived = await lib.unarchive(tokenB);

    expect(unarchived.statusCode).toBe(200);
    expect(unarchived.body).toEqual({
      packId: PACK_ID,
      isArchived: false,
      unarchivedAt: "2026-11-19T11:15:00.000Z",
      unarchivedBy: OTHER_TEACHER.accountId,
    });
    const afterUnarchive = await lib.packRepo.findById(PackId.create(PACK_ID));
    expect(afterUnarchive?.isArchived).toBe(false);
    expect(afterUnarchive?.unarchivedBy).toBe(OTHER_TEACHER.accountId);
    expect(afterUnarchive?.unarchivedAt?.toISOString()).toBe("2026-11-19T11:15:00.000Z");
    // The last archive stays on record, so it can still be explained.
    expect(afterUnarchive?.archivedBy).toBe(OTHER_TEACHER.accountId);
    expect(afterUnarchive?.archivedAt?.toISOString()).toBe("2026-11-19T11:00:00.000Z");
    expect(await lib.listedIds()).toContain(PACK_ID);
  });

  it("lets a teacher release a new version of an archived pack, which starts unarchived and is listed again", async () => {
    const lib = library();
    const tokenA = await lib.teachers.tokenFor(TEST_TEACHER);
    await lib.register(tokenA);
    expect((await lib.archive(tokenA)).statusCode).toBe(200);
    expect(await lib.listedIds()).not.toContain(PACK_ID);

    const released = await lib.register(await lib.teachers.tokenFor(OTHER_TEACHER), packBody("1.1.0"));

    expect(released.statusCode).toBe(201);
    const latest = await lib.packRepo.findById(PackId.create(PACK_ID));
    expect(latest?.version).toBe("1.1.0");
    expect(latest?.isArchived).toBe(false);
    expect(latest?.createdBy).toBe(OTHER_TEACHER.accountId);
    expect((await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "1.0.0"))?.isArchived).toBe(true);
    expect(await lib.listedIds()).toContain(PACK_ID);
  });
});

describe("shared pack library: rules that stay the same", () => {
  it("refuses to archive a System Pack", async () => {
    const lib = library();

    const response = await lib.archive(await lib.teachers.tokenFor(), DIABE_TEACH_PACK.id.value);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe("PACK_IS_SYSTEM_PACK");
    expect((await lib.packRepo.findById(DIABE_TEACH_PACK.id))?.isArchived).toBe(false);
  });

  it("refuses a new version of a System Pack and stores nothing", async () => {
    const lib = library();

    const response = await lib.register(
      await lib.teachers.tokenFor(),
      packBody("9.0.0", DIABE_TEACH_PACK.id.value),
    );

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe("PACK_IS_SYSTEM_PACK");
    expect(await lib.packRepo.existsByIdAndVersion(DIABE_TEACH_PACK.id.value, "9.0.0")).toBe(false);
    expect((await lib.packRepo.findById(DIABE_TEACH_PACK.id))?.version).toBe(DIABE_TEACH_PACK.version);
  });

  it("returns 409 when a teacher registers an existing pack id and version, even another teacher's", async () => {
    const lib = library();
    await lib.register(await lib.teachers.tokenFor(TEST_TEACHER), packBody("1.0.0", PACK_ID, "Original"));

    const response = await lib.register(await lib.teachers.tokenFor(OTHER_TEACHER), packBody("1.0.0", PACK_ID, "Overwrite"));

    expect(response.statusCode).toBe(409);
    expect(response.body).not.toHaveProperty("error");
    expect(response.body.code).toBe("PACK_ALREADY_EXISTS");
    const stored = await lib.packRepo.findByIdAndVersion(PackId.create(PACK_ID), "1.0.0");
    expect(stored?.title).toBe("Original");
    expect(stored?.createdBy).toBe(TEST_TEACHER.accountId);
  });
});
