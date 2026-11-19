import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import { readJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { SignInInstructorUseCase } from "../../../src/application/use-cases/sign-in-instructor.use-case.js";

export type SignInHandlerDependencies = Partial<ProductionDependencies>;

/** POST /api/v1/accounts/sign-in: checks an email and password and issues an Account Token. */
export function createSignInHandler(dependencies?: SignInHandlerDependencies) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new SignInInstructorUseCase({
    accountRepo: deps.accountRepo!,
    passwordHasher: deps.passwordHasher!,
    accountTokenSigner: deps.accountTokenSigner!,
    clock: deps.clock!,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    const body = readJsonObjectBody(event.body);
    const result = await useCase.execute({
      email: body.email,
      password: body.password,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        accountId: result.accountId,
        email: result.email,
        accountToken: result.accountToken,
        expiresAt: result.expiresAt.toISOString(),
      }),
    };
  };

  return createApiHandler(rawHandler, {
    bearerScheme: "none",
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey,
  });
}

export const lambdaHandler = createSignInHandler();
export default wrapLambdaHandler(lambdaHandler);
