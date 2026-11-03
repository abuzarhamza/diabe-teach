import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";

function createTestPack(overrides: Partial<{
  id: string;
  isSystemPack: boolean;
  isArchived: boolean;
}> = {}): CurriculumPack {
  return CurriculumPack.create({
    id: overrides.id ?? "test-pack",
    title: "Test Pack",
    version: "1.0.0",
    description: "A test pack.",
    boardConfig: {
      rows: 3,
      cols: 3,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      { id: "domain-1", label: "Domain 1", description: "First domain" },
    ],
    cards: [
      {
        id: "card-1",
        verbatimLabel: "Card 1",
        displayLabel: "Card 1",
        aliases: [],
        domainId: "domain-1",
        summary: "First card",
      },
    ],
    adjudicationRubric: {
      evaluatorPersona: "Test Evaluator",
      subjectDomain: "Testing",
      chainContinuityCriteria: ["Criterion 1"],
      calibrationExamples: [],
    },
    assessmentInstrument: null,
    perceptionSurvey: null,
    isSystemPack: overrides.isSystemPack ?? false,
    isArchived: overrides.isArchived ?? false,
    createdBy: "instructor-session",
    authorName: "Test Author",
    createdAt: new Date(),
    archivedAt: null,
  });
}

interface TestContext {
  tokenAdapter: FakeCapabilityTokenAdapter;
  packRepo: InMemoryCurriculumPackRepository;
  deps: {
    packRepo: InMemoryCurriculumPackRepository;
    tokenVerifier: FakeCapabilityTokenAdapter;
    apiKey: string;
    requireApiKey: boolean;
  };
}

function createTestContext(packs: CurriculumPack[] = []): TestContext {
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const packRepo = new InMemoryCurriculumPackRepository(packs);
  return {
    tokenAdapter,
    packRepo,
    deps: {
      packRepo,
      tokenVerifier: tokenAdapter,
      apiKey: "test-api-key",
      requireApiKey: true,
    },
  };
}

function createEvent(packId: string, token: string): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/api/v1/packs/${packId}/archive`,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Api-Key": "test-api-key",
    },
    body: null,
    isBase64Encoded: false,
    pathParameters: { packId },
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

describe("pOST /api/v1/packs/{packId}/archive", () => {
  it("archives a pack and returns 200", async () => {
    const pack = createTestPack();
    const ctx = createTestContext([pack]);
    const handler = createArchivePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent("test-pack", token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.packId).toBe("test-pack");
    expect(body.isArchived).toBe(true);
    expect(body.archivedAt).toBeDefined();
  });

  it("returns 403 for system pack", async () => {
    const pack = createTestPack({ isSystemPack: true });
    const ctx = createTestContext([pack]);
    const handler = createArchivePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent("test-pack", token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.code).toBe("PACK_IS_SYSTEM_PACK");
  });

  it("returns 409 for already archived pack", async () => {
    const pack = createTestPack({ isArchived: true });
    const ctx = createTestContext([pack]);
    const handler = createArchivePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent("test-pack", token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.code).toBe("PACK_ALREADY_ARCHIVED");
  });

  it("returns 404 for non-existent pack", async () => {
    const ctx = createTestContext([]);
    const handler = createArchivePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent("nonexistent-pack", token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.code).toBe("PACK_NOT_FOUND");
  });

  it("returns 403 for non-instructor role", async () => {
    const pack = createTestPack();
    const ctx = createTestContext([pack]);
    const handler = createArchivePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "participant-session",
      role: "participant",
    });

    const result = (await handler(
      createEvent("test-pack", token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(403);
  });
});
