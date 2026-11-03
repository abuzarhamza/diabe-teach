import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createListPacksHandler } from "../../netlify/functions/packs/list-packs.js";
import { FakeCapabilityTokenAdapter } from "../../src/adapters/outbound/fake-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/api/v1/packs",
    headers: {},
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    ...overrides,
  };
}

describe("get /api/v1/packs", () => {
  it("returns 200 with list of curriculum pack summaries", async () => {
    const handler = createListPacksHandler({
      packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
      tokenVerifier: new FakeCapabilityTokenAdapter(),
      apiKey: undefined,
      requireApiKey: false,
    });

    const event = makeEvent();
    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe(
      "application/json; charset=utf-8",
    );

    const body = JSON.parse(response.body);
    expect(body.packs).toBeInstanceOf(Array);
    expect(body.packs.length).toBe(1);

    const pack = body.packs[0];
    expect(pack.id).toBe("diabe-teach");
    expect(pack.title).toBe(
      "Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning",
    );
    expect(pack.cardCount).toBe(49);
    expect(pack.domainCount).toBe(7);
    expect(pack.hasAssessmentInstrument).toBe(true);
    expect(pack.hasPerceptionSurvey).toBe(true);
    expect(pack.boardConfig).toEqual({
      rows: 7,
      cols: 7,
      minChainLength: 4,
      adjacencyRule: "chebyshev-8",
    });
  });

  it("returns empty array when no packs exist", async () => {
    const handler = createListPacksHandler({
      packRepo: new InMemoryCurriculumPackRepository([]),
      tokenVerifier: new FakeCapabilityTokenAdapter(),
      apiKey: undefined,
      requireApiKey: false,
    });

    const event = makeEvent();
    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.packs).toEqual([]);
  });

  it("returns 401 when API key is required but not provided", async () => {
    const handler = createListPacksHandler({
      packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
      tokenVerifier: new FakeCapabilityTokenAdapter(),
      apiKey: "secret-key",
      requireApiKey: true,
    });

    const event = makeEvent();
    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(401);
  });

  it("returns 200 when valid API key is provided", async () => {
    const handler = createListPacksHandler({
      packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
      tokenVerifier: new FakeCapabilityTokenAdapter(),
      apiKey: "secret-key",
      requireApiKey: true,
    });

    const event = makeEvent({
      headers: { "x-api-key": "secret-key" },
    });
    const response = await handler(event, {} as any);

    expect(response.statusCode).toBe(200);
  });
});
