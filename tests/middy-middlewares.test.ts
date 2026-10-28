import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { HmacCapabilityTokenAdapter } from "../src/adapters/outbound/hmac-capability-token-adapter.js";
import { PackNotFoundError, UnauthorizedTokenError } from "../src/domain/errors/domain-errors.js";

describe("middy Middlewares (Ticket 01)", () => {
  const tokenSecret = "test-secret-key-1234567890123456";
  const tokenAdapter = new HmacCapabilityTokenAdapter(tokenSecret);

  describe("authMiddleware", () => {
    it("allows anonymous requests when apiKey is not configured", async () => {
      const handler = middy(async (event: any) => {
        return {
          statusCode: 200,
          body: JSON.stringify({ auth: event.auth ?? null }),
        };
      })
        .use(httpHeaderNormalizer())
        .use(authMiddleware({ tokenVerifier: tokenAdapter }));

      const response = await handler({
        headers: {},
      } as any, {} as any);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ auth: null });
    });

    it("verifies valid instructor Bearer JWT and sets event.auth", async () => {
      const token = await tokenAdapter.signToken({
        role: "instructor",
        sessionId: "sess-123",
      });

      const handler = middy(async (event: any) => {
        return {
          statusCode: 200,
          body: JSON.stringify({ auth: event.auth }),
        };
      })
        .use(httpHeaderNormalizer())
        .use(authMiddleware({ tokenVerifier: tokenAdapter }));

      const response = await handler({
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any, {} as any);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).auth).toEqual({
        role: "instructor",
        sessionId: "sess-123",
      });
    });

    it("throws UnauthorizedTokenError when authorization header is malformed", async () => {
      const handler = middy(async () => ({ statusCode: 200, body: "" }))
        .use(httpHeaderNormalizer())
        .use(authMiddleware({ tokenVerifier: tokenAdapter }));

      await expect(
        handler({
          headers: {
            authorization: "NotBearerToken xyz",
          },
        } as any, {} as any),
      ).rejects.toThrow(UnauthorizedTokenError);
    });

    it("rejects request with 401 when apiKey is configured and header is missing", async () => {
      const handler = middy(async () => ({ statusCode: 200, body: "" }))
        .use(httpHeaderNormalizer())
        .use(
          authMiddleware({
            tokenVerifier: tokenAdapter,
            apiKey: "secret-api-key",
            requireApiKey: true,
          }),
        );

      await expect(
        handler({
          headers: {},
        } as any, {} as any),
      ).rejects.toThrow(UnauthorizedTokenError);
    });
  });

  describe("domainErrorMiddleware", () => {
    it("converts PackNotFoundError to 404 JSON response", async () => {
      const handler = middy(async () => {
        throw new PackNotFoundError("diabe-teach");
      }).use(domainErrorMiddleware());

      const response: any = await handler({} as any, {} as any);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        code: "PACK_NOT_FOUND",
        message: "Curriculum Pack 'diabe-teach' was not found.",
        details: { packId: "diabe-teach" },
      });
    });

    it("converts UnauthorizedTokenError to 401 JSON response", async () => {
      const handler = middy(async () => {
        throw new UnauthorizedTokenError("Malformed or invalid token.");
      }).use(domainErrorMiddleware());

      const response: any = await handler({} as any, {} as any);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        code: "UNAUTHORIZED_TOKEN",
        message: "Malformed or invalid token.",
      });
    });
  });
});
