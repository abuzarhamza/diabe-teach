import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createValidatePackHandler } from "../../netlify/functions/packs/validate-pack.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";

function createMinimalValidPack(): Record<string, unknown> {
  return {
    id: "test-pack",
    title: "Test Pack",
    version: "1.0.0",
    description: "A test pack for validation.",
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
  };
}

interface TestContext {
  tokenAdapter: FakeCapabilityTokenAdapter;
  deps: {
    tokenVerifier: FakeCapabilityTokenAdapter;
    apiKey: string;
    requireApiKey: boolean;
  };
}

function createTestContext(): TestContext {
  const tokenAdapter = new FakeCapabilityTokenAdapter();
  return {
    tokenAdapter,
    deps: {
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
    path: "/api/v1/packs/validate",
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

describe("pOST /api/v1/packs/validate", () => {
  it("returns valid: true for a complete valid pack", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const pack = createMinimalValidPack();
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it("returns errors for missing required fields", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });
    const pack = {
      id: "",
      title: "",
      version: "",
      description: "",
    };

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors.some((e: { code: string }) => e.code === "REQUIRED_FIELD")).toBe(true);
  });

  it("returns errors when card references unknown domain", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });
    const pack = createMinimalValidPack();
    const cards = pack.cards as Array<Record<string, unknown>>;
    if (cards && cards[0]) {
      cards[0].domainId = "nonexistent-domain";
    }

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(false);
    expect(body.errors.some((e: { code: string }) => e.code === "INVALID_DOMAIN_REF")).toBe(true);
  });

  it("returns warnings for optional fields", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });
    const pack = createMinimalValidPack();
    pack.assessmentInstrument = null;
    pack.perceptionSurvey = null;

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(true);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w: { code: string }) => w.code === "OPTIONAL_FIELD_MISSING")).toBe(true);
  });

  it("returns 403 for non-instructor role", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
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

  it("validates packId follows slug pattern", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });
    const pack = createMinimalValidPack();
    pack.id = "Invalid Pack ID!";

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(false);
    expect(body.errors.some((e: { code: string }) => e.code === "INVALID_PACK_ID")).toBe(true);
  });

  it("validates version follows semver pattern", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.tokenAdapter.signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });
    const pack = createMinimalValidPack();
    pack.version = "v1";

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(false);
    expect(body.errors.some((e: { code: string }) => e.code === "INVALID_VERSION")).toBe(true);
  });
});
