import type { APIGatewayProxyResult } from "aws-lambda";
import type {
  AuthenticatedEvent,
} from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { AccountTokenVerifierPort } from "../../../src/application/ports/account-token.port.js";
import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ValidateCurriculumPackUseCase } from "../../../src/application/use-cases/validate-curriculum-pack.use-case.js";
import { UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface ValidatePackHandlerDependencies {
  readonly accountTokenVerifier?: AccountTokenVerifierPort;
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
    // Any signed-in teacher may validate a draft pack, with no Game
    // Session needed (ADR-0007).
    if (!event.account) {
      throw new UnauthorizedTokenError("An Account Token is required to validate curriculum packs. Sign in first.");
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
        bearerScheme: "AccountAuth",
        accountTokenVerifier: deps.accountTokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey,
      }),
    )
    .use(domainErrorMiddleware());
}

export const lambdaHandler = createValidatePackHandler();
export default wrapLambdaHandler(lambdaHandler);
