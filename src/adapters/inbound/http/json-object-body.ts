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
