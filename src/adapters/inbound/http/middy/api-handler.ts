import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { AuthMiddlewareOptions } from "./auth.middleware.js";
import middy from "@middy/core";
import { authMiddleware } from "./auth.middleware.js";
import { domainErrorMiddleware } from "./domain-error.middleware.js";
import { jsonObjectBodyMiddleware } from "./json-object-body.middleware.js";
import { unexpectedErrorMiddleware } from "./unexpected-error.middleware.js";

/**
 * The one middleware chain every `/api/v1` route uses. `before` steps run in
 * order, `onError` steps in reverse:
 *
 * 1. `authMiddleware`: x-api-key and bearer token. A route with
 *    `tokenRequired` refuses a missing token here, so a caller without a
 *    valid token gets 401 whatever its body.
 * 2. `jsonObjectBodyMiddleware`: `@middy/http-json-body-parser`, then "must
 *    be a JSON object". Anything else is 400 `INVALID_REQUEST_BODY`.
 * 3. `domainErrorMiddleware` (onError): DomainError to its status code.
 * 4. `unexpectedErrorMiddleware` (onError, last): anything else is a generic
 *    500; the stack is only logged.
 */
export function createApiHandler<TEvent extends APIGatewayProxyEvent>(
  rawHandler: (event: TEvent) => Promise<APIGatewayProxyResult>,
  authOptions: AuthMiddlewareOptions,
) {
  return middy(rawHandler)
    .use(unexpectedErrorMiddleware())
    .use(domainErrorMiddleware())
    .use(authMiddleware(authOptions))
    .use(jsonObjectBodyMiddleware());
}
