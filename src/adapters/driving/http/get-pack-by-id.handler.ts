import { CapabilityTokenPort } from "../../../application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";
import {
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdUseCase,
} from "../../../application/use-cases/get-curriculum-pack-by-id.use-case.js";
import { PackNotFoundError } from "../../../domain/errors/domain-errors.js";
import {
  createEndpointHandler,
  EndpointHttpHandler,
  HttpRequestInput,
  parseBearerTokenHeader,
  RouteContext,
} from "./endpoint-handler.factory.js";

export type { EndpointHttpHandler, RouteContext };

export interface GetPackByIdHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

const GET_PACK_BY_ID_URL_PATTERN = /^\/api\/v1\/packs\/([^/]+)\/?$/;

function resolvePackIdFromContextOrUrl(
  request: Request,
  context?: RouteContext,
): string {
  const paramPackId = context?.params?.packId;
  if (typeof paramPackId === "string") {
    return decodeURIComponent(paramPackId);
  }

  const url = new URL(request.url);
  const match = GET_PACK_BY_ID_URL_PATTERN.exec(url.pathname);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  throw new PackNotFoundError("");
}

/**
 * Pure Request Transformer: converts raw HTTP (Request + Netlify/Lambda Context)
 * into the typed Application/Domain query.
 */
export function transformGetPackByIdRequest({
  request,
  context,
}: HttpRequestInput): GetCurriculumPackByIdQuery {
  return {
    packId: resolvePackIdFromContextOrUrl(request, context),
    bearerToken: parseBearerTokenHeader(request.headers.get("authorization")),
  };
}

/**
 * Factory: wires Request Transformer -> GetCurriculumPackByIdUseCase -> HTTP Response.
 */
export function createGetPackByIdHandler(
  deps: GetPackByIdHandlerDependencies,
): EndpointHttpHandler {
  const useCase = new GetCurriculumPackByIdUseCase(deps);

  return createEndpointHandler({
    transformRequest: transformGetPackByIdRequest,
    execute: (query) => useCase.execute(query),
  });
}
