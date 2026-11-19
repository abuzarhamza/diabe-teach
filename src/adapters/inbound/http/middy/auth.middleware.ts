import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent } from "aws-lambda";
import type {
  AccountTokenVerifierPort,
  VerifiedAccount,
} from "../../../../application/ports/account-token.port.js";
import type {
  CapabilityTokenPort,
  VerifiedCapability,
} from "../../../../application/ports/capability-token.port.js";
import { timingSafeEqual } from "node:crypto";
import { UnauthorizedTokenError } from "../../../../domain/errors/domain-errors.js";

export type AuthenticatedEvent = APIGatewayProxyEvent & {
  /** The verified Capability Token (`BearerAuth`), or null when none was sent. */
  auth?: VerifiedCapability | null;
  /** The verified Account Token (`AccountAuth`), or null when none was sent. */
  account?: VerifiedAccount | null;
  body?: unknown;
};

/**
 * Which OpenAPI bearer scheme a route uses: `BearerAuth` takes Capability
 * Tokens, `AccountAuth` takes Account Tokens. A route accepts exactly one
 * kind; the other kind is an invalid token there. `none` (sign-up and
 * sign-in) ignores any Authorization header.
 */
export type BearerScheme = "BearerAuth" | "AccountAuth" | "none";

export interface AuthMiddlewareOptions {
  readonly tokenVerifier?: CapabilityTokenPort;
  /** Defaults to `BearerAuth`. */
  readonly bearerScheme?: BearerScheme;
  readonly accountTokenVerifier?: AccountTokenVerifierPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

/**
 * Case-insensitive header lookup helper.
 * Supports both normalized (lowercase) and original casing.
 */
function getHeader(
  headers: Record<string, string | undefined>,
  name: string,
): string | undefined {
  // Try lowercase first (normalized headers)
  const lower = headers[name.toLowerCase()];
  if (lower !== undefined)
    return lower;

  // Fallback to case-insensitive search
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

const INVALID_ACCOUNT_TOKEN_MESSAGE = "Malformed, invalid, or expired account token.";

/** Fails closed: a present but unverifiable Account Token is a 401. */
async function verifyAccountToken(
  verifier: AccountTokenVerifierPort | undefined,
  token: string,
): Promise<VerifiedAccount> {
  const verified = verifier
    ? await verifier.verifyAccountToken(token)
    : null;
  if (!verified) {
    throw new UnauthorizedTokenError(INVALID_ACCOUNT_TOKEN_MESSAGE);
  }
  return verified;
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
        const providedKey = getHeader(headers, "x-api-key");
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
      if (options.bearerScheme === "none") {
        event.auth = null;
        event.account = null;
        return;
      }
      const rawAuth = getHeader(headers, "authorization");
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
        if (options.bearerScheme === "AccountAuth") {
          event.auth = null;
          event.account = await verifyAccountToken(options.accountTokenVerifier, token);
          return;
        }

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
        event.account = null;
      }
      else {
        event.auth = null;
        event.account = null;
      }
    },
  };
}
