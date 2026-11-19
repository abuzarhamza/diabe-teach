import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { VerifiedAccount } from "../../src/application/ports/account-token.port.js";
import { describe, expect, it } from "vitest";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { createListPacksHandler } from "../../netlify/functions/packs/list-packs.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { InstructorAccount } from "../../src/domain/instructor-account/instructor-account.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

/**
 * The pack list (teacher-login ticket 06, ADR-0007): each pack shows the
 * author handle of its latest Pack Version (worked out from the account's
 * email when the list is read) and its version, and archived packs can be
 * included on request.
 */

const API_KEY = "test-api-key";
const PACK_ID = "listed-pack";

const RAHMAN: VerifiedAccount = { accountId: "account-rahman", email: "rahman.s@aku.edu" };
const KHAN: VerifiedAccount = { accountId: "account-khan", email: "khan.a@example.edu" };

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;

interface ListedPack {
  readonly id: string;
  readonly version: string;
  readonly authorHandle: string | null;
  readonly isArchived: boolean;
}

function packBody(version = "1.0.0", id = PACK_ID): Record<string, unknown> {
  return {
    id,
    title: `Listed Pack ${version}`,
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

/** A pack registered before Instructor Accounts: `createdBy` is a session id. */
function legacyPack(): CurriculumPack {
  return CurriculumPack.create({
    ...(packBody("0.9.0", "legacy-pack") as unknown as Parameters<typeof CurriculumPack.create>[0]),
    isSystemPack: false,
    isArchived: false,
    createdBy: "instructor-session-from-2025",
    authorName: null,
    createdAt: new Date("2025-06-01T00:00:00.000Z"),
    archivedAt: null,
    archivedBy: null,
  });
}

function makeEvent(
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    packId?: string;
    query?: Record<string, string>;
  } = {},
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
    queryStringParameters: options.query ?? null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

async function call(handler: Handler, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return await handler(event, {} as never) as APIGatewayProxyResult;
}

/** Teachers with real Instructor Accounts, a shared library, and the pack routes. */
async function library(initialPacks: readonly CurriculumPack[] = [DIABE_TEACH_PACK]) {
  const packRepo = new InMemoryCurriculumPackRepository([...initialPacks]);
  const accountRepo = new InMemoryInstructorAccountRepository();
  for (const teacher of [RAHMAN, KHAN]) {
    await accountRepo.create(InstructorAccount.register({
      accountId: teacher.accountId,
      email: teacher.email,
      passwordHash: "not-a-real-hash",
      createdAt: new Date("2026-11-19T08:00:00.000Z"),
    }));
  }
  const teachers = new SignedInTeachers();
  const writeDeps = {
    packRepo,
    accountTokenVerifier: teachers.verifier,
    apiKey: API_KEY,
    requireApiKey: true,
  };
  const register = createRegisterPackHandler(writeDeps) as Handler;
  const archive = createArchivePackHandler(writeDeps) as Handler;
  const list = createListPacksHandler({
    packRepo,
    accountRepo,
    apiKey: API_KEY,
    requireApiKey: true,
  }) as Handler;

  return {
    register: async (teacher: VerifiedAccount, body: unknown = packBody()) => {
      const response = await call(register, makeEvent("POST", "/api/v1/packs", { token: await teachers.tokenFor(teacher), body }));
      expect(response.statusCode).toBe(201);
    },
    archive: async (teacher: VerifiedAccount, packId = PACK_ID) => {
      const response = await call(archive, makeEvent("POST", `/api/v1/packs/${packId}/archive`, {
        token: await teachers.tokenFor(teacher),
        packId,
      }));
      expect(response.statusCode).toBe(200);
    },
    listRaw: async (query?: Record<string, string>) =>
      call(list, makeEvent("GET", "/api/v1/packs", { query })),
    list: async (query?: Record<string, string>) => {
      const response = await call(list, makeEvent("GET", "/api/v1/packs", { query }));
      expect(response.statusCode).toBe(200);
      return (JSON.parse(response.body) as { packs: ListedPack[] }).packs;
    },
  };
}

function find(packs: readonly ListedPack[], id: string): ListedPack | undefined {
  return packs.find(pack => pack.id === id);
}

describe("get /api/v1/packs: author handle and version", () => {
  it("lists a pack registered by rahman.s@aku.edu with author handle rahman.s and its latest version", async () => {
    const lib = await library();
    await lib.register(RAHMAN, packBody("1.1.0"));

    const listed = find(await lib.list(), PACK_ID);

    expect(listed).toMatchObject({ authorHandle: "rahman.s", version: "1.1.0", isArchived: false });
  });

  it("shows teacher B's handle and v2 after teacher B releases v2 of teacher A's pack", async () => {
    const lib = await library();
    await lib.register(RAHMAN, packBody("1.0.0"));
    await lib.register(KHAN, packBody("2.0.0"));

    const packs = await lib.list();

    expect(packs.filter(pack => pack.id === PACK_ID)).toHaveLength(1);
    expect(find(packs, PACK_ID)).toMatchObject({ authorHandle: "khan.a", version: "2.0.0" });
  });

  it("lists a legacy pack, whose createdBy is not an account, with no author handle", async () => {
    const lib = await library([
      DIABE_TEACH_PACK,
      legacyPack(),
    ]);

    const packs = await lib.list();

    expect(find(packs, "legacy-pack")).toMatchObject({ authorHandle: null, version: "0.9.0" });
    // The System Pack has no releasing account either.
    expect(find(packs, DIABE_TEACH_PACK.id.value)?.authorHandle).toBeNull();
  });

  it("puts no email address other than the handle in the list response", async () => {
    const lib = await library();
    await lib.register(RAHMAN, packBody("1.0.0"));
    await lib.register(KHAN, packBody("1.0.0", "other-pack"));
    await lib.archive(KHAN, "other-pack");

    for (const query of [
      undefined,
      { includeArchived: "true" },
    ]) {
      const response = await lib.listRaw(query);

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("rahman.s");
      expect(response.body).not.toContain("@");
      expect(response.body).not.toContain("aku.edu");
      expect(response.body).not.toContain("example.edu");
    }
  });
});

describe("get /api/v1/packs: archived packs", () => {
  it("hides archived packs by default and lists them, marked archived, with includeArchived=true", async () => {
    const lib = await library();
    await lib.register(RAHMAN, packBody("1.0.0"));
    await lib.register(RAHMAN, packBody("1.0.0", "kept-pack"));
    await lib.archive(KHAN, PACK_ID);

    const byDefault = await lib.list();
    expect(find(byDefault, PACK_ID)).toBeUndefined();
    expect(find(byDefault, "kept-pack")?.isArchived).toBe(false);

    for (const query of [
      { includeArchived: "false" },
      { includeArchived: "yes" },
    ]) {
      expect(find(await lib.list(query), PACK_ID)).toBeUndefined();
    }

    const withArchived = await lib.list({ includeArchived: "true" });
    expect(find(withArchived, PACK_ID)).toMatchObject({
      isArchived: true,
      version: "1.0.0",
      authorHandle: "rahman.s",
    });
    expect(find(withArchived, "kept-pack")?.isArchived).toBe(false);
    expect(find(withArchived, DIABE_TEACH_PACK.id.value)?.isArchived).toBe(false);
  });
});
