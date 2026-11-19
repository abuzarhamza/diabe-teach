import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ArchiveCurriculumPackUseCase } from "../../../src/application/use-cases/archive-curriculum-pack.use-case.js";
import { UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export function createArchivePackHandler(
  dependencies?: Partial<ProductionDependencies>,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new ArchiveCurriculumPackUseCase({
    packRepo: deps.packRepo,
    clock: deps.clock,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    // Any signed-in teacher may archive any non-system pack (ADR-0007).
    const account = event.account;
    if (!account) {
      throw new UnauthorizedTokenError("An Account Token is required to archive curriculum packs. Sign in first.");
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

    const result = await useCase.execute({ packId, accountId: account.accountId });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        packId: result.packId,
        isArchived: result.isArchived,
        archivedAt: result.archivedAt.toISOString(),
        archivedBy: result.archivedBy,
      }),
    };
  };

  return createApiHandler(rawHandler, {
    bearerScheme: "AccountAuth",
    accountTokenVerifier: deps.accountTokenVerifier,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey,
    tokenRequired: true,
    missingTokenMessage: "An Account Token is required to archive curriculum packs. Sign in first.",
  });
}

export const lambdaHandler = createArchivePackHandler();
export default wrapLambdaHandler(lambdaHandler);
