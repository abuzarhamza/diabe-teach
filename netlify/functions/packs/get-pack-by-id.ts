import type { Config } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { GetCurriculumPackByIdUseCase } from "../../../src/application/use-cases/get-curriculum-pack-by-id.use-case.js";
import { PackNotFoundError } from "../../../src/domain/errors/domain-errors.js";

export function createGetPackByIdHandler(
  dependencies?: ProductionDependencies,
) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new GetCurriculumPackByIdUseCase(deps);

  const rawHandler = async (
    event: APIGatewayProxyEvent & { auth?: any },
  ): Promise<APIGatewayProxyResult> => {
    const rawPackId = event.pathParameters?.packId;
    if (!rawPackId || typeof rawPackId !== "string") {
      throw new PackNotFoundError("");
    }

    const packId = decodeURIComponent(rawPackId);

    const result = await useCase.execute({
      packId,
      verifiedCapability: event.auth ?? undefined,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
    };
  };

  return middy(rawHandler)
    .use(httpHeaderNormalizer())
    .use(
      authMiddleware({
        tokenVerifier: deps.tokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey,
      }),
    )
    .use(domainErrorMiddleware());
}

export default createGetPackByIdHandler();

export const config: Config = {
  path: "/api/v1/packs/:packId",
  method: "GET",
};
