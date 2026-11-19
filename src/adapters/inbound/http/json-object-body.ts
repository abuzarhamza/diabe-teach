import { MalformedRequestBodyError } from "../../../domain/errors/domain-errors.js";

/**
 * Reads a request body that must be a JSON object, whether it arrives as the
 * raw string or already parsed. Throws MalformedRequestBodyError (400).
 */
export function readJsonObjectBody(body: unknown): Record<string, unknown> {
  let parsed: unknown = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    }
    catch {
      throw new MalformedRequestBodyError();
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new MalformedRequestBodyError();
  }
  return parsed as Record<string, unknown>;
}

/**
 * Like readJsonObjectBody, but a request with no body reads as `{}`. The
 * shared middleware chain has already refused any body that is not a JSON
 * object, so this only narrows the type.
 */
export function readOptionalJsonObjectBody(body: unknown): Record<string, unknown> {
  return body === undefined || body === null || body === ""
    ? {}
    : readJsonObjectBody(body);
}
