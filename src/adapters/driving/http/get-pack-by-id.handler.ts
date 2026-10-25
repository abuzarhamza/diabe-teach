import { CapabilityTokenPort } from "../../../application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";
import { GetCurriculumPackByIdUseCase } from "../../../application/use-cases/get-curriculum-pack-by-id.use-case.js";
import {
  DomainError,
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../../domain/errors/domain-errors.js";

export interface RouteContext {
  readonly params?: Readonly<Record<string, string | undefined>>;
}

export interface GetPackByIdHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export type EndpointHttpHandler = (
  request: Request,
  context?: RouteContext,
) => Promise<Response>;

const GET_PACK_BY_ID_URL_PATTERN = /^\/api\/v1\/packs\/([^/]+)\/?$/;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function parseBearerTokenHeader(
  authorizationHeader: string | null,
): string | null {
  if (authorizationHeader === null) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/.exec(authorizationHeader.trim());
  if (!match || !match[1]) {
    throw new UnauthorizedTokenError(
      "Malformed Authorization header. Expected 'Bearer <token>'.",
    );
  }
  return match[1];
}

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

export function createGetPackByIdHandler(
  deps: GetPackByIdHandlerDependencies,
): EndpointHttpHandler {
  const getPackByIdUseCase = new GetCurriculumPackByIdUseCase({
    packRepo: deps.packRepo,
    tokenVerifier: deps.tokenVerifier,
  });

  return async function handleGetPackById(
    request: Request,
    context?: RouteContext,
  ): Promise<Response> {
    try {
      const packId = resolvePackIdFromContextOrUrl(request, context);
      const bearerToken = parseBearerTokenHeader(
        request.headers.get("authorization"),
      );
      const result = await getPackByIdUseCase.execute({
        packId,
        bearerToken,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      if (error instanceof DomainError) {
        return mapDomainErrorToResponse(error);
      }
      throw error;
    }
  };
}
