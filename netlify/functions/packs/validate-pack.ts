import type { APIGatewayProxyResult } from "aws-lambda";
import type {
  AuthenticatedEvent,
} from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { CapabilityTokenPort } from "../../../src/application/ports/capability-token.port.js";
import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ValidateCurriculumPackUseCase } from "../../../src/application/use-cases/validate-curriculum-pack.use-case.js";
import { ForbiddenRoleError } from "../../../src/domain/errors/domain-errors.js";

export interface ValidatePackHandlerDependencies {
  readonly tokenVerifier: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createValidatePackHandler(
  dependencies?: ValidatePackHandlerDependencies,
) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new ValidateCurriculumPackUseCase();

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    if (event.auth?.role !== "instructor") {
      throw new ForbiddenRoleError(
        "Only instructors can validate curriculum packs.",
      );
    }

    const pack = (typeof event.body === "object" && event.body !== null)
      ? event.body as Record<string, unknown>
      : {};

    const result = await useCase.execute({ pack: pack as never });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
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

export const lambdaHandler = createValidatePackHandler();
export default wrapLambdaHandler(lambdaHandler);
