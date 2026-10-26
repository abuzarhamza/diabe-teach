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
        BearerAuth: (_c: OpenApiContext, request: Request): Promise<unknown> =>
          OpenApiHttpApp.#authenticateBearer(request, deps),
      },
      handlers: {
        getCurriculumPackById: (
          c: OpenApiContext,
          request: Request,
          context?: RouteContext,
        ): Promise<Response> => {
          const { errorMessage, capability } =
            OpenApiHttpApp.#resolveBearerSecurity(c);
          if (errorMessage) {
            return Promise.resolve(
              BaseHttpHandler.jsonResponse(
                {
                  code: "UNAUTHORIZED_TOKEN",
                  message: errorMessage,
                },
                401,
              ),
            );
          }

          return getPackByIdHandler.handle(request, {
            params: {
              ...(c.request.params as Record<string, string | undefined>),
              ...(context?.params ?? {}),
            },
            verifiedCapability: capability,
          });
        },
        unauthorizedHandler: (c: OpenApiContext): Response =>
          BaseHttpHandler.jsonResponse(
            {
              code: "UNAUTHORIZED_TOKEN",
              message: OpenApiHttpApp.#getUnauthorizedMessage(c),
            },
            401,
          ),
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

  static async #authenticateBearer(
    request: Request,
    deps: AppDependencies,
  ): Promise<unknown> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return false;
    }
    const token = BaseHttpHandler.parseBearerTokenHeader(authHeader);
    const verified =
      token && deps.tokenVerifier
        ? await deps.tokenVerifier.verifyToken(token)
        : null;

    if (!verified) {
      throw new UnauthorizedTokenError(
        BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
      );
    }
    return verified;
  }

  static #resolveBearerSecurity(c: OpenApiContext): {
    errorMessage?: string;
    capability?: VerifiedCapability;
  } {
    const sec = c.security?.BearerAuth as
      | { error?: unknown; role?: string }
      | undefined;
    if (!sec || typeof sec !== "object") {
      return {};
    }
    if ("error" in sec) {
      const err = sec.error;
      return {
        errorMessage:
          err instanceof Error
            ? err.message
            : BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
      };
    }
    return { capability: sec as VerifiedCapability };
  }

  static #getUnauthorizedMessage(c: OpenApiContext): string {
    const { errorMessage } = OpenApiHttpApp.#resolveBearerSecurity(c);
    if (errorMessage) {
      return errorMessage;
    }
    const isBearerOnly = c.operation?.security?.every?.(
      (req) => "BearerAuth" in req && !("ApiKeyAuth" in req),
    );
    return isBearerOnly
      ? BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE
      : BaseHttpHandler.INVALID_API_KEY_MESSAGE;
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
