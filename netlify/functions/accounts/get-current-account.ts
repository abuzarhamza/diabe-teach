import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { GetCurrentInstructorAccountUseCase } from "../../../src/application/use-cases/get-current-instructor-account.use-case.js";
import { UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export type GetCurrentAccountHandlerDependencies = Partial<ProductionDependencies>;

/** GET /api/v1/accounts/me: the Instructor Account an Account Token belongs to. */
export function createGetCurrentAccountHandler(
  dependencies?: GetCurrentAccountHandlerDependencies,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new GetCurrentInstructorAccountUseCase({
    accountRepo: deps.accountRepo!,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    if (!event.account) {
      throw new UnauthorizedTokenError("An Account Token is required. Sign in first.");
    }
    const result = await useCase.execute({ accountId: event.account.accountId });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        accountId: result.accountId,
        email: result.email,
        createdAt: result.createdAt.toISOString(),
      }),
    };
  };

  return createApiHandler(rawHandler, {
    bearerScheme: "AccountAuth",
    accountTokenVerifier: deps.accountTokenVerifier,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey,
    tokenRequired: true,
    missingTokenMessage: "An Account Token is required. Sign in first.",
  });
}

export const lambdaHandler = createGetCurrentAccountHandler();
export default wrapLambdaHandler(lambdaHandler);
