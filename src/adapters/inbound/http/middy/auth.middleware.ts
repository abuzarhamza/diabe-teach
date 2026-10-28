import type { MiddlewareObj } from "@middy/core";
import type { CapabilityTokenPort } from "../../../../application/ports/capability-token.port.js";
import { timingSafeEqual } from "node:crypto";
import { UnauthorizedTokenError } from "../../../../domain/errors/domain-errors.js";

export interface AuthMiddlewareOptions {
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function authMiddleware(
  options: AuthMiddlewareOptions = {},
): MiddlewareObj<any, any> {
  return {
    before: async (request) => {
      const { event } = request;
      const headers = event.headers ?? {};

      // 1. Validate x-api-key if required or configured
      const shouldEnforceApiKey
        = options.requireApiKey === true
          || (typeof options.apiKey === "string" && options.apiKey.length > 0);

      if (shouldEnforceApiKey) {
        const providedKey = headers["x-api-key"];
        if (
          !options.apiKey
          || options.apiKey.trim().length === 0
          || typeof providedKey !== "string"
        ) {
          throw new UnauthorizedTokenError(
            "Missing or invalid x-api-key header.",
          );
        }

        const actualBuf = Buffer.from(providedKey.trim(), "utf8");
        const expectedBuf = Buffer.from(options.apiKey.trim(), "utf8");

        const isValid
          = actualBuf.length === expectedBuf.length
            && timingSafeEqual(actualBuf, expectedBuf);

        if (!isValid) {
          throw new UnauthorizedTokenError(
            "Missing or invalid x-api-key header.",
          );
        }
      }

      // 2. Validate Authorization Bearer token if present
      const rawAuth = headers.authorization;
      if (rawAuth) {
        if (typeof rawAuth !== "string") {
          throw new UnauthorizedTokenError(
            "Malformed Authorization header. Expected 'Bearer <token>'.",
          );
        }

        const match = /^Bearer\s+(\S+)$/.exec(rawAuth.trim());
        if (!match || !match[1]) {
          throw new UnauthorizedTokenError(
            "Malformed Authorization header. Expected 'Bearer <token>'.",
          );
        }

        const token = match[1];
        if (!options.tokenVerifier) {
          throw new UnauthorizedTokenError(
            "Malformed, invalid, or expired capability token.",
          );
        }

        const verified = await options.tokenVerifier.verifyToken(token);
        if (!verified) {
          throw new UnauthorizedTokenError(
            "Malformed, invalid, or expired capability token.",
          );
        }

        event.auth = verified;
      }
      else {
        event.auth = null;
      }
    },
  };
}
