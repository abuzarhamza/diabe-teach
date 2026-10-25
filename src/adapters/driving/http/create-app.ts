import { CapabilityTokenPort } from "../../../application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";
import { GetCurriculumPackByIdUseCase } from "../../../application/use-cases/get-curriculum-pack-by-id.use-case.js";
import {
  DomainError,
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../../domain/errors/domain-errors.js";

export interface AppDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface HttpApp {
  fetch(request: Request): Promise<Response>;
}

const GET_PACK_BY_ID_PATTERN = /^\/api\/v1\/packs\/([^/]+)\/?$/;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function mapDomainErrorToResponse(error: DomainError): Response {
  const payload: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  } = {
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

export function createApp(deps: AppDependencies): HttpApp {
  const getPackByIdUseCase = new GetCurriculumPackByIdUseCase({
    packRepo: deps.packRepo,
    tokenVerifier: deps.tokenVerifier,
  });

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === "GET") {
        const match = GET_PACK_BY_ID_PATTERN.exec(url.pathname);
        if (match && match[1]) {
          try {
            const packId = decodeURIComponent(match[1]);
            const authorizationHeader = request.headers.get("authorization");
            const result = await getPackByIdUseCase.execute({
              packId,
              authorizationHeader,
            });
            return jsonResponse(result, 200);
          } catch (error) {
            if (error instanceof DomainError) {
              return mapDomainErrorToResponse(error);
            }
            throw error;
          }
        }
      }

      return jsonResponse(
        {
          code: "PACK_NOT_FOUND",
          message: `Route ${request.method} ${url.pathname} not found.`,
        },
        404,
      );
    },
  };
}
