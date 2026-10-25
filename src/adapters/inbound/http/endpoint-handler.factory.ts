import { timingSafeEqual } from "node:crypto";
import {
  DomainError,
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../../domain/errors/domain-errors.js";
import {
  ApiKeyValidationConfig,
  EndpointHttpHandler,
  HttpEndpointDefinition,
  RouteContext,
} from "./http-handler.types.js";

export const INVALID_API_KEY_MESSAGE = "Missing or invalid x-api-key header.";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function verifyApiKeyHeader(
  providedHeader: string | null,
  config: ApiKeyValidationConfig,
): boolean {
  const shouldEnforce =
    config.requireApiKey === true ||
    (typeof config.apiKey === "string" && config.apiKey.length > 0);

  if (!shouldEnforce) {
    return true;
  }

  if (
    !config.apiKey ||
    config.apiKey.trim().length === 0 ||
    !providedHeader
  ) {
    return false;
  }

  const actualBuf = Buffer.from(providedHeader.trim(), "utf8");
  const expectedBuf = Buffer.from(config.apiKey.trim(), "utf8");

  return (
    actualBuf.length === expectedBuf.length &&
    timingSafeEqual(actualBuf, expectedBuf)
  );
}

export function assertValidApiKeyHeader(
  request: Request,
  config: ApiKeyValidationConfig,
): void {
  if (!verifyApiKeyHeader(request.headers.get("x-api-key"), config)) {
    throw new UnauthorizedTokenError(INVALID_API_KEY_MESSAGE);
  }
}

export function parseBearerTokenHeader(
  authorizationHeader: string | null,
): string | null {
  if (authorizationHeader === null) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/.exec(authorizationHeader.trim());
  if (!match || !match[1]) {
    throw new UnauthorizedTokenError(
      "Malformed Authorization header. Expected 'Bearer <token>'.",
    );
  }
  return match[1];
}

export function mapDomainErrorToResponse(error: DomainError): Response {
  const payload = {
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };

  if (error instanceof UnauthorizedTokenError) {
    return jsonResponse(payload, 401);
  }
  if (error instanceof PackNotFoundError) {
    return jsonResponse(payload, 404);
  }
  return jsonResponse(payload, 400);
}

export function createEndpointHandler<TQuery, TResult>(
  definition: HttpEndpointDefinition<TQuery, TResult>,
): EndpointHttpHandler {
  const successStatus = definition.successStatus ?? 200;

  return async function handleEndpointRequest(
    request: Request,
    context?: RouteContext,
  ): Promise<Response> {
    try {
      assertValidApiKeyHeader(request, definition);
      const query = await definition.transformRequest({ request, context });
      const result = await definition.execute(query);
      return jsonResponse(result, successStatus);
    } catch (error) {
      if (error instanceof DomainError) {
        return mapDomainErrorToResponse(error);
      }
      throw error;
    }
  };
}
