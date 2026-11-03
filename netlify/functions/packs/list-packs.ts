import type { Config } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ListCurriculumPacksUseCase } from "../../../src/application/use-cases/list-curriculum-packs.use-case.js";

export function createListPacksHandler(
  dependencies?: ProductionDependencies,
) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new ListCurriculumPacksUseCase(deps);

  const rawHandler = async (
    _event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const result = await useCase.execute();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
    };
  };

  return middy(rawHandler)
    .use(
      authMiddleware({
        tokenVerifier: deps.tokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey,
      }),
    )
    .use(domainErrorMiddleware());
}

// Lambda handler for unit tests and production
export const lambdaHandler = createListPacksHandler();

// v2 handler for Netlify CLI local dev
export default wrapLambdaHandler(lambdaHandler);

export const config: Config = {
  path: "/api/v1/packs",
  method: "GET",
};
