import {
  DomainError,
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../../domain/errors/domain-errors.js";

export interface RouteContext {
  readonly params?: Readonly<Record<string, string | undefined>>;
}

export interface HttpRequestInput {
  readonly request: Request;
  readonly context?: RouteContext;
}

export type EndpointHttpHandler = (
  request: Request,
  context?: RouteContext,
) => Promise<Response>;

export interface HttpEndpointDefinition<TQuery, TResult> {
  readonly transformRequest: (
    input: HttpRequestInput,
  ) => TQuery | Promise<TQuery>;
  readonly execute: (query: TQuery) => Promise<TResult>;
  readonly successStatus?: number;
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
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
