import type { Config } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ListCurriculumPacksUseCase } from "../../../src/application/use-cases/list-curriculum-packs.use-case.js";

export function createListPacksHandler(
  dependencies?: ProductionDependencies,
) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new ListCurriculumPacksUseCase(deps);

  const rawHandler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    // `?includeArchived=true` adds archived packs (marked `isArchived`), for
    // Game setup's "Show archived". By default they stay hidden.
    const includeArchived = event.queryStringParameters?.includeArchived === "true";
    const result = await useCase.execute({ includeArchived });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
    };
  };

  return createApiHandler(rawHandler, {
    tokenVerifier: deps.tokenVerifier,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey,
  });
}

// Lambda handler for unit tests and production
export const lambdaHandler = createListPacksHandler();

// v2 handler for Netlify CLI local dev

export const config: Config = {
  path: "/api/v1/packs",
  method: "GET",
};
