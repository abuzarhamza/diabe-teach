import { describe, expect, it } from "vitest";
import { createGetPackByIdHandler } from "../../netlify/functions/packs/get-pack-by-id.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

describe("discrete Function: netlify/functions/packs/get-pack-by-id.ts (Ticket 02)", () => {
  const tokenSecret = "test-secret-key-1234567890123456";
  const tokenAdapter = new HmacCapabilityTokenAdapter(tokenSecret);
  const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);

  const handler = createGetPackByIdHandler({
    packRepo,
    tokenVerifier: tokenAdapter,
  });

  it("returns 200 OK with redacted questions for anonymous request", async () => {
    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {},
    };

    const response = await handler(event as any, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.pack.id).toBe("diabe-teach");
    expect(body.pack.cards).toHaveLength(49);
    // Redacted answers for anonymous
    expect(body.pack.assessmentInstrument.questions[0].correctIndex).toBeUndefined();
    expect(body.pack.assessmentInstrument.questions[0].explanation).toBeUndefined();
  });

  it("returns 200 OK with unredacted questions for instructor token", async () => {
    const token = await tokenAdapter.signToken({
      role: "instructor",
      sessionId: "sess-1",
    });

    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    const response = await handler(event as any, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.pack.assessmentInstrument.questions[0].correctIndex).toBeDefined();
    expect(body.pack.assessmentInstrument.questions[0].explanation).toBeDefined();
  });

  it("returns 404 PACK_NOT_FOUND when requesting non-existent pack", async () => {
    const event = {
      pathParameters: { packId: "unknown-pack" },
      headers: {},
    };

    const response = await handler(event as any, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("PACK_NOT_FOUND");
  });

  it("returns 401 UNAUTHORIZED_TOKEN when authorization header is invalid", async () => {
    const event = {
      pathParameters: { packId: "diabe-teach" },
      headers: {
        authorization: "Bearer invalid.jwt.token",
      },
    };

    const response = await handler(event as any, {} as any);

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("UNAUTHORIZED_TOKEN");
  });
});
