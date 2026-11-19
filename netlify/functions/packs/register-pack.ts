import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { RegisterCurriculumPackUseCase } from "../../../src/application/use-cases/register-curriculum-pack.use-case.js";
import { UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export function createRegisterPackHandler(
  dependencies?: Partial<ProductionDependencies>,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new RegisterCurriculumPackUseCase({
    packRepo: deps.packRepo,
    clock: deps.clock,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    // Any signed-in teacher may register a pack or release a new Pack
    // Version of any non-system pack (ADR-0007).
    if (!event.account) {
      throw new UnauthorizedTokenError("An Account Token is required to register curriculum packs. Sign in first.");
    }

    const pack = (typeof event.body === "object" && event.body !== null)
      ? event.body as Record<string, unknown>
      : {};

    const result = await useCase.execute({
      pack: pack as never,
      accountId: event.account.accountId,
    });

    if (!result.success) {
      if (result.code === "PACK_ALREADY_EXISTS") {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            error: {
              code: result.code,
              message: `Pack '${result.packId}' version '${result.version}' already exists.`,
            },
          }),
        };
      }

      return {
        statusCode: 422,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: {
            code: result.code,
            errors: result.errors,
            warnings: result.warnings,
          },
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        packId: result.packId,
        version: result.version,
        warnings: result.warnings,
      }),
    };
  };

  return middy(rawHandler)
    .use(httpJsonBodyParser())
    .use(
      authMiddleware({
        bearerScheme: "AccountAuth",
        accountTokenVerifier: deps.accountTokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey,
      }),
    )
    .use(domainErrorMiddleware());
}

export const lambdaHandler = createRegisterPackHandler();
export default wrapLambdaHandler(lambdaHandler);
