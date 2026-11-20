import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createValidatePackHandler } from "../../netlify/functions/packs/validate-pack.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

function createCards(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    verbatimLabel: `Card ${index + 1}`,
    displayLabel: `Card ${index + 1}`,
    aliases: [],
    domainId: "domain-1",
    summary: `Card number ${index + 1}`,
  }));
}

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
    // A 3×3 board needs at least 9 Keyword Cards.
    cards: createCards(9),
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
  teachers: SignedInTeachers;
  deps: {
    accountTokenVerifier: SignedInTeachers["verifier"];
    apiKey: string;
    requireApiKey: boolean;
  };
}

function createTestContext(): TestContext {
  const teachers = new SignedInTeachers();
  return {
    teachers,
    deps: {
      accountTokenVerifier: teachers.verifier,
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
    const token = await ctx.teachers.tokenFor();

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.valid).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it("returns 400 naming a missing required field (request schema, api-hardening 06)", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.teachers.tokenFor();
    const { boardConfig: _omitted, ...pack } = createMinimalValidPack();

    const result = (await handler(
      createEvent(pack, token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe("INVALID_REQUEST_BODY");
    expect(body.details).toEqual({ field: "boardConfig", reason: "is required" });
  });

  it("returns errors for empty required fields", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.teachers.tokenFor();
    const pack = {
      ...createMinimalValidPack(),
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
    const token = await ctx.teachers.tokenFor();
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
    const token = await ctx.teachers.tokenFor();
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

  it("returns 401 for an instructor Capability Token instead of an Account Token", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await new FakeCapabilityTokenAdapter().signToken({
      sessionId: "instructor-session",
      role: "instructor",
    });

    const result = (await handler(
      createEvent(createMinimalValidPack(), token),
      {} as never,
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(401);
  });

  it("validates packId follows slug pattern", async () => {
    const ctx = createTestContext();
    const handler = createValidatePackHandler(ctx.deps);
    const token = await ctx.teachers.tokenFor();
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
    const token = await ctx.teachers.tokenFor();
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

  describe("pack capacity: the cards must fill the board", () => {
    async function validate(pack: Record<string, unknown>) {
      const ctx = createTestContext();
      const handler = createValidatePackHandler(ctx.deps);
      const token = await ctx.teachers.tokenFor();
      const result = (await handler(
        createEvent(pack, token),
        {} as never,
      )) as APIGatewayProxyResult;
      expect(result.statusCode).toBe(200);
      return JSON.parse(result.body) as {
        valid: boolean;
        errors: Array<{ path: string; code: string; message: string }>;
      };
    }

    it("reports the card shortfall when a pack has fewer cards than rows × cols", async () => {
      const pack = createMinimalValidPack();
      pack.cards = createCards(8);

      const body = await validate(pack);

      expect(body.valid).toBe(false);
      const issue = body.errors.find(e => e.code === "INSUFFICIENT_CARDS");
      expect(issue).toBeDefined();
      expect(issue?.path).toBe("cards");
      expect(issue?.message).toContain("8");
      expect(issue?.message).toContain("9");
      expect(issue?.message).toContain("3×3");
    });

    it("accepts a pack with exactly rows × cols cards", async () => {
      const body = await validate(createMinimalValidPack());

      expect(body.valid).toBe(true);
      expect(body.errors).toHaveLength(0);
    });

    it("accepts a pack with more cards than rows × cols", async () => {
      const pack = createMinimalValidPack();
      pack.cards = createCards(12);

      const body = await validate(pack);

      expect(body.valid).toBe(true);
      expect(body.errors).toHaveLength(0);
    });
  });
});
