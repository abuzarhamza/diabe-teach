import { timingSafeEqual } from "node:crypto";
import {
  DomainError,
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../../domain/errors/domain-errors.js";
import {
  ApiKeyValidationConfig,
  HttpRequestInput,
  RouteContext,
} from "./http-handler.types.js";

export abstract class BaseHttpHandler<TQuery, TResult> {
  public static readonly INVALID_API_KEY_MESSAGE =
    "Missing or invalid x-api-key header.";
  public static readonly INVALID_CAPABILITY_TOKEN_MESSAGE =
    "Malformed, invalid, or expired capability token.";

  protected readonly successStatus: number;

  protected constructor(successStatus = 200) {
    this.successStatus = successStatus;
  }

  public abstract transformRequest(
    input: HttpRequestInput,
  ): TQuery | Promise<TQuery>;

  protected abstract execute(query: TQuery): Promise<TResult>;

  public async handle(
    request: Request,
    context?: RouteContext,
  ): Promise<Response> {
    try {
      const query = await this.transformRequest({ request, context });
      const result = await this.execute(query);
      return BaseHttpHandler.jsonResponse(result, this.successStatus);
    } catch (error) {
      if (error instanceof DomainError) {
        return BaseHttpHandler.mapDomainErrorToResponse(error);
      }
      throw error;
    }
  }

  public static jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }

  public static verifyApiKeyHeader(
    providedHeader: string | null,
    config: ApiKeyValidationConfig,
  ): boolean {
    const shouldEnforce =
      config.requireApiKey === true ||
      (typeof config.apiKey === "string" && config.apiKey.length > 0);

    if (!shouldEnforce) {
      return true;
    }

    if (
      !config.apiKey ||
      config.apiKey.trim().length === 0 ||
      !providedHeader
    ) {
      return false;
    }

    const actualBuf = Buffer.from(providedHeader.trim(), "utf8");
    const expectedBuf = Buffer.from(config.apiKey.trim(), "utf8");

    return (
      actualBuf.length === expectedBuf.length &&
      timingSafeEqual(actualBuf, expectedBuf)
    );
  }

  public static parseBearerTokenHeader(
    authorizationHeader: string | null,
  ): string | null {
    if (authorizationHeader === null) {
      return null;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
    if (!match || !match[1]) {
      throw new UnauthorizedTokenError(
        BaseHttpHandler.INVALID_CAPABILITY_TOKEN_MESSAGE,
      );
    }
    return match[1];
  }

  public static mapDomainErrorToResponse(error: DomainError): Response {
    const payload = {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };

    if (error instanceof UnauthorizedTokenError) {
      return BaseHttpHandler.jsonResponse(payload, 401);
    }
    if (error instanceof PackNotFoundError) {
      return BaseHttpHandler.jsonResponse(payload, 404);
    }
    return BaseHttpHandler.jsonResponse(payload, 400);
  }
}
