import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ApiOperationId } from "../request-schemas.generated.js";
import type { AuthMiddlewareOptions } from "./auth.middleware.js";
import middy from "@middy/core";
import { authMiddleware } from "./auth.middleware.js";
import { domainErrorMiddleware } from "./domain-error.middleware.js";
import { jsonObjectBodyMiddleware } from "./json-object-body.middleware.js";
import { requestBodySchemaMiddleware } from "./request-body-schema.middleware.js";
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
 * 3. `requestBodySchemaMiddleware`: the body against the request schema of
 *    the route's `operationId`, generated from docs/api/openapi.yaml. A
 *    missing field, wrong type or unknown enum value is 400
 *    `INVALID_REQUEST_BODY` naming the field. Skipped for operations with no
 *    request body.
 * 4. `domainErrorMiddleware` (onError): DomainError to its status code.
 * 5. `unexpectedErrorMiddleware` (onError, last): anything else is a generic
 *    500; the stack is only logged.
 *
 * Every route passes the OpenAPI `operationId` it implements, so a new
 * route's body is validated without extra work.
 */
export function createApiHandler<TEvent extends APIGatewayProxyEvent>(
  rawHandler: (event: TEvent) => Promise<APIGatewayProxyResult>,
  authOptions: AuthMiddlewareOptions,
  operationId: ApiOperationId,
) {
  return middy(rawHandler)
    .use(unexpectedErrorMiddleware())
    .use(domainErrorMiddleware())
    .use(authMiddleware(authOptions))
    .use(jsonObjectBodyMiddleware())
    .use(requestBodySchemaMiddleware(operationId));
}
