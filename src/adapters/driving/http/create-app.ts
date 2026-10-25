import { CapabilityTokenPort } from "../../../application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";
import {
  createGetPackByIdHandler,
  RouteContext,
} from "./get-pack-by-id.handler.js";

export interface AppDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface HttpApp {
  fetch(request: Request, context?: RouteContext): Promise<Response>;
}

const GET_PACK_BY_ID_PATTERN = /^\/api\/v1\/packs\/([^/]+)\/?$/;

export function createApp(deps: AppDependencies): HttpApp {
  const getPackByIdHandler = createGetPackByIdHandler(deps);

  return {
    async fetch(request: Request, context?: RouteContext): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === "GET") {
        const match = GET_PACK_BY_ID_PATTERN.exec(url.pathname);
        if (match && match[1]) {
          return getPackByIdHandler(request, {
            params: {
              packId: context?.params?.packId ?? match[1],
            },
          });
        }
      }

      return new Response(
        JSON.stringify({
          code: "INVALID_REQUEST_BODY",
          message: `Route ${request.method} ${url.pathname} is not supported.`,
        }),
        {
          status: 404,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        },
      );
    },
  };
}
