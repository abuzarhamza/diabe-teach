import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { createGetPackByIdHandler } from "../../netlify/functions/packs/get-pack-by-id.js";
import { createListPacksHandler } from "../../netlify/functions/packs/list-packs.js";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

/**
 * react-packs 00: the pack list and pack detail say which packs are System
 * Packs (`isSystemPack`), so the web app can hide Archive and "save as new
 * version" instead of waiting for a 403. The flag must agree with the rule
 * that refuses those writes with PACK_IS_SYSTEM_PACK.
 */

const API_KEY = "test-api-key";
const TEACHER_PACK_ID = "teacher-pack";

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;

function packBody(id: string, version: string): Record<string, unknown> {
  return {
    id,
    title: `Pack ${id} ${version}`,
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

async function library() {
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const teachers = new SignedInTeachers();
  const deps = {
    packRepo,
    accountTokenVerifier: teachers.verifier,
    apiKey: API_KEY,
    requireApiKey: true,
  };
  const register = createRegisterPackHandler(deps) as Handler;
  const archive = createArchivePackHandler(deps) as Handler;
  const list = createListPacksHandler({
    packRepo,
    accountRepo: new InMemoryInstructorAccountRepository(),
    apiKey: API_KEY,
    requireApiKey: true,
  }) as Handler;
  const detail = createGetPackByIdHandler({ packRepo, apiKey: API_KEY, requireApiKey: true }) as Handler;
  const token = await teachers.tokenFor();

  const registered = await invoke(register, makeEvent("POST", "/api/v1/packs", {
    token,
    body: packBody(TEACHER_PACK_ID, "1.0.0"),
  }));
  expect(registered.statusCode).toBe(201);

  return {
    listed: async () => {
      const response = await invoke(list, makeEvent("GET", "/api/v1/packs"));
      expect(response.statusCode).toBe(200);
      return response.body.packs as Array<{ id: string; isSystemPack: unknown }>;
    },
    detail: async (packId: string) =>
      invoke(detail, makeEvent("GET", `/api/v1/packs/${packId}`, { packId })),
    archive: async (packId: string) =>
      invoke(archive, makeEvent("POST", `/api/v1/packs/${packId}/archive`, { token, packId })),
    newVersion: async (packId: string) =>
      invoke(register, makeEvent("POST", "/api/v1/packs", {
        token,
        body: packBody(packId, "99.0.0"),
      })),
  };
}

function refusedAsSystemPack(response: { statusCode: number; body: Record<string, any> }): boolean {
  return response.statusCode === 403 && response.body.code === "PACK_IS_SYSTEM_PACK";
}

describe("isSystemPack on the pack list and pack detail", () => {
  it("the list marks the System Pack true and a teacher's pack false", async () => {
    const lib = await library();

    const listed = await lib.listed();

    expect(listed.find(pack => pack.id === DIABE_TEACH_PACK.id.value)?.isSystemPack).toBe(true);
    expect(listed.find(pack => pack.id === TEACHER_PACK_ID)?.isSystemPack).toBe(false);
  });

  it("the detail marks the System Pack true and a teacher's pack false", async () => {
    const lib = await library();

    const system = await lib.detail(DIABE_TEACH_PACK.id.value);
    const teacher = await lib.detail(TEACHER_PACK_ID);

    expect(system.statusCode).toBe(200);
    expect(system.body.pack.isSystemPack).toBe(true);
    expect(teacher.statusCode).toBe(200);
    expect(teacher.body.pack.isSystemPack).toBe(false);
  });

  it("is true exactly when archiving and a new version are refused with PACK_IS_SYSTEM_PACK", async () => {
    const lib = await library();
    const listedFlags = new Map((await lib.listed()).map(pack => [pack.id, pack.isSystemPack]));

    for (const packId of [DIABE_TEACH_PACK.id.value, TEACHER_PACK_ID]) {
      const detailFlag = (await lib.detail(packId)).body.pack.isSystemPack;
      const newVersionRefused = refusedAsSystemPack(await lib.newVersion(packId));
      const archiveRefused = refusedAsSystemPack(await lib.archive(packId));

      expect(listedFlags.get(packId), packId).toBe(archiveRefused);
      expect(detailFlag, packId).toBe(archiveRefused);
      expect(newVersionRefused, packId).toBe(archiveRefused);
    }
  });
});
