import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { UnarchiveCurriculumPackUseCase } from "../../../src/application/use-cases/unarchive-curriculum-pack.use-case.js";
import { ForbiddenRoleError } from "../../../src/domain/errors/domain-errors.js";

export function createUnarchivePackHandler(
  dependencies?: Partial<ProductionDependencies>,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new UnarchiveCurriculumPackUseCase({ packRepo: deps.packRepo });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    if (event.auth?.role !== "instructor") {
      throw new ForbiddenRoleError(
        "Only instructors can unarchive curriculum packs.",
      );
    }

    const packId = event.pathParameters?.packId;
    if (!packId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: { code: "MISSING_PACK_ID", message: "packId is required." },
        }),
      };
    }

    const result = await useCase.execute({ packId });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        packId: result.packId,
        isArchived: result.isArchived,
      }),
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

export const lambdaHandler = createUnarchivePackHandler();
export default wrapLambdaHandler(lambdaHandler);
