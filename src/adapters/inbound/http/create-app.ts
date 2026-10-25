import { resolve } from "node:path";
import { OpenAPIBackend, type Context as OpenApiContext } from "openapi-backend";
import { jsonResponse } from "./endpoint-handler.factory.js";
import { createGetPackByIdHandler } from "./get-pack-by-id.handler.js";
import {
  AppDependencies,
  HttpApp,
  RouteContext,
} from "./http-handler.types.js";

const OPENAPI_YAML_PATH = resolve(process.cwd(), "docs/api/openapi.yaml");

export function createApp(deps: AppDependencies): HttpApp {
  const getPackByIdHandler = createGetPackByIdHandler(deps);

  const api = new OpenAPIBackend({
    definition: OPENAPI_YAML_PATH,
    quick: true,
    validate: false,
    handlers: {
      getCurriculumPackById: (
        c: OpenApiContext,
        request: Request,
        context?: RouteContext,
      ): Promise<Response> =>
        getPackByIdHandler(request, {
          params: {
            ...(c.request.params as Record<string, string | undefined>),
            ...(context?.params ?? {}),
          },
        }),
      notFound: (_c: OpenApiContext, request: Request): Response => {
        const url = new URL(request.url);
        return jsonResponse(
          {
            code: "INVALID_REQUEST_BODY",
            message: `Route ${request.method} ${url.pathname} is not supported.`,
          },
          404,
        );
      },
    },
  });

  const initPromise = api.init();

  return {
    async fetch(request: Request, context?: RouteContext): Promise<Response> {
      await initPromise;
      const url = new URL(request.url);
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return (await api.handleRequest(
        {
          method: request.method,
          path: url.pathname,
          headers,
        },
        request,
        context,
      )) as Response;
    },
  };
}
