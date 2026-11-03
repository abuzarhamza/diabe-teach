import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createRegisterPackHandler } from "../../netlify/functions/packs/register-pack.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";

function createMinimalValidPack(): Record<string, unknown> {
  return {
    id: "test-pack",
    title: "Test Pack",
    version: "1.0.0",
    description: "A test pack for registration.",
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
    authorName: "Test Author",
  };
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

function createTestContext(): TestContext {
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  const packRepo = new InMemoryCurriculumPackRepository([]);
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

function createEvent(
  body: Record<string, unknown>,
  token: string,
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/api/v1/packs",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Api-Key": "test-api-key",
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

describe("pOST /api/v1/packs", () => {
  it("registers a valid pack and returns 201", async () => {
    const ctx = createTestContext();
    const handler = createRegisterPackHandler(ctx.deps);
    const pack = createMinimalValidPack();
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.packId).toBe("test-pack");
    expect(body.version).toBe("1.0.0");
  });

  it("returns 409 for duplicate pack version", async () => {
    const ctx = createTestContext();
    const handler = createRegisterPackHandler(ctx.deps);
    const pack = createMinimalValidPack();
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    await handler(createEvent(pack, token), {} as never);

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("PACK_ALREADY_EXISTS");
  });

  it("returns 422 for invalid pack structure", async () => {
    const ctx = createTestContext();
    const handler = createRegisterPackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const invalidPack = {
      id: "Invalid ID!",
      title: "",
    };

    const result = (await handler(
      createEvent(invalidPack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("PACK_VALIDATION_FAILED");
    expect(body.error.errors.length).toBeGreaterThan(0);
  });

  it("returns 403 for non-instructor role", async () => {
    const ctx = createTestContext();
    const handler = createRegisterPackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "participant-session",
      role: "participant",
    });

    const result = (await handler(
      createEvent(createMinimalValidPack(), token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(403);
  });

  it("allows registering same packId with different version", async () => {
    const ctx = createTestContext();
    const handler = createRegisterPackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const pack1 = createMinimalValidPack();
    pack1.version = "1.0.0";
    await handler(createEvent(pack1, token), {} as never);

    const pack2 = createMinimalValidPack();
    pack2.version = "2.0.0";

    const result = (await handler(
      createEvent(pack2, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.version).toBe("2.0.0");
  });
});
