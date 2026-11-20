import type { MiddlewareObj } from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { MalformedRequestBodyError } from "../../../../domain/errors/domain-errors.js";

const NOT_JSON_MESSAGE = "The request body must be valid JSON sent with Content-Type: application/json.";
const NOT_AN_OBJECT_MESSAGE = "The request body must be a JSON object.";

/**
 * Parses a JSON request body with `@middy/http-json-body-parser` and requires
 * a JSON object. A body that is malformed, sent without a JSON content type,
 * or of the wrong shape (array, string, number, null) becomes a 400
 * `INVALID_REQUEST_BODY` (MalformedRequestBodyError); the parser's own error,
 * which carries the library's message and stack, is never surfaced.
 *
 * A request with no body at all is left alone (`event.body` becomes
 * undefined), so bodiless routes and optional bodies keep working.
 *
 * Runs after `authMiddleware`, so a caller without a valid token gets 401
 * before the body is read.
 */
export function jsonObjectBodyMiddleware(): MiddlewareObj<any, any> {
  const parser = httpJsonBodyParser();
  return {
    before: async (request) => {
      const { event } = request;
      const raw: unknown = event.body;
      if (raw === undefined || raw === null || raw === "") {
        event.body = undefined;
        return;
      }

      if (typeof raw === "string") {
        try {
          await parser.before!(request);
        }
        catch {
          throw new MalformedRequestBodyError(NOT_JSON_MESSAGE);
        }
      }

      const parsed: unknown = event.body;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new MalformedRequestBodyError(NOT_AN_OBJECT_MESSAGE);
      }
    },
  };
}
