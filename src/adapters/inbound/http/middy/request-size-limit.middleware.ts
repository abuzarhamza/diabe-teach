import type { MiddlewareObj } from "@middy/core";
import { Buffer } from "node:buffer";
import { PayloadTooLargeError } from "../../../../domain/errors/domain-errors.js";

/** The largest request body any `/api/v1` route accepts: 256 KB. */
export const MAX_REQUEST_BODY_BYTES = 256 * 1024;

/**
 * Measures the raw body in bytes (UTF-8, or decoded bytes for a base64 body),
 * not in characters, so multi-byte text can't slip past the limit.
 */
function rawBodyBytes(body: string, isBase64Encoded: boolean): number {
  return Buffer.byteLength(body, isBase64Encoded
    ? "base64"
    : "utf8");
}

/**
 * Refuses a request body over `maxBytes` with 413 `PAYLOAD_TOO_LARGE`
 * (PayloadTooLargeError) before it is parsed. Runs after `authMiddleware`, so
 * a caller without a valid token still gets 401 first.
 */
export function requestSizeLimitMiddleware(maxBytes = MAX_REQUEST_BODY_BYTES): MiddlewareObj<any, any> {
  return {
    before: async (request) => {
      const raw: unknown = request.event.body;
      if (typeof raw !== "string" || raw === "") {
        return;
      }
      if (rawBodyBytes(raw, request.event.isBase64Encoded === true) > maxBytes) {
        throw new PayloadTooLargeError(maxBytes);
      }
    },
  };
}
