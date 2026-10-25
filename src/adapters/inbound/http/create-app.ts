import { resolve } from "node:path";
import { OpenAPIBackend, type Context as OpenApiContext } from "openapi-backend";
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
        BearerAuth: (): boolean => true,
      },
      handlers: {
        getCurriculumPackById: (
          c: OpenApiContext,
          request: Request,
          context?: RouteContext,
        ): Promise<Response> =>
          getPackByIdHandler.handle(request, {
            params: {
              ...(c.request.params as Record<string, string | undefined>),
              ...(context?.params ?? {}),
            },
          }),
        unauthorizedHandler: (): Response =>
          BaseHttpHandler.jsonResponse(
            {
              code: "UNAUTHORIZED_TOKEN",
              message: BaseHttpHandler.INVALID_API_KEY_MESSAGE,
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
