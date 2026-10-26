import { resolve } from "node:path";
import { OpenAPIBackend, type Context as OpenApiContext } from "openapi-backend";
import { VerifiedCapability } from "../../../application/ports/capability-token.port.js";
import { UnauthorizedTokenError } from "../../../domain/errors/domain-errors.js";
import { BaseHttpHandler } from "./endpoint-handler.factory.js";
import { GetPackByIdHttpHandler } from "./get-pack-by-id.handler.js";
import {
  AppDependencies,
  HttpApp,
  RouteContext,
} from "./http-handler.types.js";

export class OpenApiHttpApp implements HttpApp {
  static readonly #OPENAPI_YAML_PATH = resolve(
    process.cwd(),
    "docs/api/openapi.yaml",
  );

  readonly #api: OpenAPIBackend;
  readonly #initPromise: Promise<unknown>;

  public constructor(deps: AppDependencies) {
    const getPackByIdHandler = new GetPackByIdHttpHandler(deps);

    this.#api = new OpenAPIBackend({
      definition: OpenApiHttpApp.#OPENAPI_YAML_PATH,
      quick: true,
      validate: false,
      securityHandlers: {
        ApiKeyAuth: (_c: OpenApiContext, request: Request): boolean =>
          BaseHttpHandler.verifyApiKeyHeader(
            request.headers.get("x-api-key"),
            deps,
          ),
        BearerAuth: async (
          _c: OpenApiContext,
          request: Request,
        ): Promise<unknown> => {
          const authHeader = request.headers.get("authorization");
          if (!authHeader) {
            return false;
          }
          const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
          if (!match || !match[1]) {
            throw new UnauthorizedTokenError(
              BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
            );
          }
          const token = match[1];
          if (!deps.tokenVerifier) {
            throw new UnauthorizedTokenError(
              BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
            );
          }
          const verified = await deps.tokenVerifier.verifyToken(token);
          if (!verified) {
            throw new UnauthorizedTokenError(
              BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
            );
          }
          return verified;
        },
      },
      handlers: {
        getCurriculumPackById: (
          c: OpenApiContext,
          request: Request,
          context?: RouteContext,
        ): Promise<Response> => {
          const bearerSecurity = c.security?.BearerAuth;
          if (
            bearerSecurity &&
            typeof bearerSecurity === "object" &&
            "error" in bearerSecurity
          ) {
            const err = (bearerSecurity as { error: unknown }).error;
            const message =
              err instanceof Error
                ? err.message
                : BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE;
            return Promise.resolve(
              BaseHttpHandler.jsonResponse(
                {
                  code: "UNAUTHORIZED_TOKEN",
                  message,
                },
                401,
              ),
            );
          }
          const verifiedCapability =
            bearerSecurity &&
            typeof bearerSecurity === "object" &&
            !("error" in bearerSecurity)
              ? (bearerSecurity as VerifiedCapability)
              : undefined;

          return getPackByIdHandler.handle(request, {
            params: {
              ...(c.request.params as Record<string, string | undefined>),
              ...(context?.params ?? {}),
            },
            verifiedCapability,
          });
        },
        unauthorizedHandler: (c: OpenApiContext): Response => {
          const bearerSecurity = c.security?.BearerAuth;
          const bearerErr =
            bearerSecurity &&
            typeof bearerSecurity === "object" &&
            "error" in bearerSecurity
              ? (bearerSecurity as { error: unknown }).error
              : null;

          const isBearerOnly =
            c.operation?.security &&
            Array.isArray(c.operation.security) &&
            c.operation.security.length > 0 &&
            c.operation.security.every(
              (req) => "BearerAuth" in req && !("ApiKeyAuth" in req),
            );

          let message = BaseHttpHandler.INVALID_API_KEY_MESSAGE;
          if (bearerErr instanceof Error) {
            message = bearerErr.message;
          } else if (isBearerOnly) {
            message = BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE;
          }

          return BaseHttpHandler.jsonResponse(
            {
              code: "UNAUTHORIZED_TOKEN",
              message,
            },
            401,
          );
        },
        notFound: (_c: OpenApiContext, request: Request): Response => {
          const url = new URL(request.url);
          return BaseHttpHandler.jsonResponse(
            {
              code: "INVALID_REQUEST_BODY",
              message: `Route ${request.method} ${url.pathname} is not supported.`,
            },
            404,
          );
        },
        notImplemented: (c: OpenApiContext): Response =>
          BaseHttpHandler.jsonResponse(
            {
              code: "INVALID_REQUEST_BODY",
              message: `Operation '${c.operation.operationId ?? "unknown"}' is not implemented yet.`,
            },
            501,
          ),
      },
    });

    this.#initPromise = this.#api.init();
  }

  public async fetch(
    request: Request,
    context?: RouteContext,
  ): Promise<Response> {
    await this.#initPromise;
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return (await this.#api.handleRequest(
      {
        method: request.method,
        path: url.pathname,
        headers,
      },
      request,
      context,
    )) as Response;
  }
}
