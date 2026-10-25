import { GetCurriculumPackByIdQuery } from "../../../application/ports/get-curriculum-pack-by-id.port.js";
import { GetCurriculumPackByIdUseCase } from "../../../application/use-cases/get-curriculum-pack-by-id.use-case.js";
import { PackNotFoundError } from "../../../domain/errors/domain-errors.js";
import {
  createEndpointHandler,
  parseBearerTokenHeader,
} from "./endpoint-handler.factory.js";
import {
  EndpointHttpHandler,
  GetPackByIdHandlerDependencies,
  HttpRequestInput,
  RouteContext,
} from "./http-handler.types.js";

function resolvePackIdFromContext(context?: RouteContext): string {
  const paramPackId = context?.params?.packId;
  if (typeof paramPackId === "string" && paramPackId.length > 0) {
    return decodeURIComponent(paramPackId);
  }
  throw new PackNotFoundError("");
}

/**
 * Pure Request Transformer: converts raw HTTP (Request + OpenAPI RouteContext)
 * into the typed Application/Domain query.
 */
export function transformGetPackByIdRequest({
  request,
  context,
}: HttpRequestInput): GetCurriculumPackByIdQuery {
  return {
    packId: resolvePackIdFromContext(context),
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
