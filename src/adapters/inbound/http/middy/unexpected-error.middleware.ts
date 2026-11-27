import type { MiddlewareObj } from "@middy/core";
import type { LoggerPort } from "../../../../application/ports/logger.port.js";
import type { RequestLogFields } from "../lambda-to-v2-wrapper.types.js";
import { SilentLogger } from "../../../../application/services/silent-logger.js";

export const INTERNAL_ERROR_BODY = {
  code: "INTERNAL_ERROR",
  message: "An unexpected error occurred.",
} as const;

/**
 * The last line of defence: any error no other middleware turned into a
 * response becomes a 500 with a generic message. The error is logged at
 * `error` as `{ err }` (pino's error serializer: class, message, stack) on
 * the server only, never sent to the caller.
 *
 * It logs through the request's logger (`event.logger`, which carries the
 * request id), else through `logger`, else nowhere (`SilentLogger`).
 */
export function unexpectedErrorMiddleware(logger: LoggerPort = new SilentLogger()): MiddlewareObj<any, any> {
  return {
    onError: async (request) => {
      if (request.response !== undefined) {
        return;
      }
      const event = request.event as Partial<RequestLogFields> | undefined;
      (event?.logger ?? logger).error({ err: request.error }, "unhandled error in API handler");
      request.response = {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(INTERNAL_ERROR_BODY),
      };
    },
  };
}
