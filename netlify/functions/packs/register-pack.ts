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
import { ForbiddenRoleError } from "../../../src/domain/errors/domain-errors.js";

export function createRegisterPackHandler(
  dependencies?: Partial<ProductionDependencies>,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new RegisterCurriculumPackUseCase({ packRepo: deps.packRepo });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    if (event.auth?.role !== "instructor") {
      throw new ForbiddenRoleError(
        "Only instructors can register curriculum packs.",
      );
    }

    const pack = (typeof event.body === "object" && event.body !== null)
      ? event.body as Record<string, unknown>
      : {};

    const result = await useCase.execute({
      pack: pack as never,
      instructorSessionId: event.auth.sessionId,
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
        tokenVerifier: deps.tokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey,
      }),
    )
    .use(domainErrorMiddleware());
}

export const lambdaHandler = createRegisterPackHandler();
export default wrapLambdaHandler(lambdaHandler);
