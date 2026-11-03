import { describe, expect, it } from "vitest";
import { createGetPackByIdHandler } from "../../netlify/functions/packs/get-pack-by-id.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

describe("gET /api/v1/packs/:packId Discrete Netlify Function", () => {
  const secret = "test-secret-key-1234567890123456";
  const tokenVerifier = new HmacCapabilityTokenAdapter(secret);
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
  const handler = createGetPackByIdHandler({ packRepo, tokenVerifier });

  it("returns 200 OK with the complete 49-card diabe-teach CurriculumPack, 7 SemanticDomains, and Figure 2 CalibrationExamples", async () => {
    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {},
    };

    const response = await handler(event as any, {} as any);
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.pack.id).toBe("diabe-teach");
    expect(body.pack.title).toBe(
      "Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning",
    );
    expect(body.pack.cards).toHaveLength(49);
    expect(body.pack.domains).toHaveLength(7);
    expect(body.pack.boardConfig).toEqual({
      rows: 7,
      cols: 7,
      minChainLength: 4,
      adjacencyRule: "chebyshev-8",
    });

    const receivedVerbatims = body.pack.cards.map((c: any) => c.verbatimLabel);
    expect(receivedVerbatims).toHaveLength(49);
    expect(receivedVerbatims).toContain("Insulin");
    expect(receivedVerbatims).toContain("Glucose");
    expect(receivedVerbatims).toContain("LADA");
    expect(receivedVerbatims).toContain("Hyperglycaemia");
    expect(receivedVerbatims).toContain("Keto-acidosis");
    expect(receivedVerbatims).toContain("Glucosuria");
    expect(receivedVerbatims).toContain("ACE Inhibitors");
  });

  it("returns 404 PACK_NOT_FOUND conforming to ApiErrorResponse when requesting an unknown packId", async () => {
    const event = {
      pathParameters: { packId: "cardio-teach-unknown" },
      headers: {},
    };

    const response = await handler(event as any, {} as any);
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body);
    expect(body).toEqual({
      code: "PACK_NOT_FOUND",
      message: "Curriculum Pack 'cardio-teach-unknown' was not found.",
      details: { packId: "cardio-teach-unknown" },
    });
  });

  it("redacts correctIndex and explanation for anonymous callers while returning all 10 MCQs and 9 Likert items", async () => {
    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {},
    };

    const response = await handler(event as any, {} as any);
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.pack.assessmentInstrument.questions).toHaveLength(10);
    expect(body.pack.perceptionSurvey.items).toHaveLength(9);

    for (const question of body.pack.assessmentInstrument.questions) {
      expect(question.correctIndex).toBeUndefined();
      expect(question.explanation).toBeUndefined();
    }
  });

  it("redacts correctIndex and explanation for a valid participantToken", async () => {
    const participantToken = await tokenVerifier.signToken({
      role: "participant",
      sessionId: "session-abc",
      participantId: "part-123",
    });

    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {
        authorization: `Bearer ${participantToken}`,
      },
    };

    const response = await handler(event as any, {} as any);
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    for (const question of body.pack.assessmentInstrument.questions) {
      expect(question.correctIndex).toBeUndefined();
      expect(question.explanation).toBeUndefined();
    }
  });

  it("includes correctIndex and explanation for a valid instructorToken without mutating pack for anonymous", async () => {
    const instructorToken = await tokenVerifier.signToken({
      role: "instructor",
      sessionId: "session-abc",
    });

    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {
        authorization: `Bearer ${instructorToken}`,
      },
    };

    const response = await handler(event as any, {} as any);
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    for (const question of body.pack.assessmentInstrument.questions) {
      expect(typeof question.correctIndex).toBe("number");
      expect(typeof question.explanation).toBe("string");
    }

    // Verify subsequent anonymous call is still redacted
    const anonRes = await handler(
      {
        pathParameters: { packId: "diabe-teach" },
        headers: {},
      } as any,
      {} as any,
    );
    const anonBody = JSON.parse(anonRes.body);
    expect(anonBody.pack.assessmentInstrument.questions[0].correctIndex).toBeUndefined();
  });

  it("returns 401 UNAUTHORIZED_TOKEN when Authorization header is malformed or invalid", async () => {
    const malformedRes = await handler(
      {
        pathParameters: { packId: "diabe-teach" },
        headers: { authorization: "Basic abc" },
      } as any,
      {} as any,
    );
    expect(malformedRes.statusCode).toBe(401);

    const tamperedRes = await handler(
      {
        pathParameters: { packId: "diabe-teach" },
        headers: { authorization: "Bearer invalid.token.payload" },
      } as any,
      {} as any,
    );
    expect(tamperedRes.statusCode).toBe(401);
  });

  it("enforces API key validation when apiKey is configured", async () => {
    const securedHandler = createGetPackByIdHandler({
      packRepo,
      tokenVerifier,
      apiKey: "secret-key-42",
      requireApiKey: true,
    });

    const unauthedRes = await securedHandler(
      {
        pathParameters: { packId: "diabe-teach" },
        headers: {},
      } as any,
      {} as any,
    );
    expect(unauthedRes.statusCode).toBe(401);

    const authedRes = await securedHandler(
      {
        pathParameters: { packId: "diabe-teach" },
        headers: { "x-api-key": "secret-key-42" },
      } as any,
      {} as any,
    );
    expect(authedRes.statusCode).toBe(200);
  });
});
