import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { ProductionDependencies } from "../../../src/app-runtime.types.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { RegisterCurriculumPackUseCase } from "../../../src/application/use-cases/register-curriculum-pack.use-case.js";
import {
  PackAlreadyExistsError,
  PackValidationFailedError,
  UnauthorizedTokenError,
} from "../../../src/domain/errors/domain-errors.js";

export function createRegisterPackHandler(
  dependencies?: Partial<ProductionDependencies>,
) {
  const deps = {
    ...AppRuntime.getProductionDependencies(),
    ...dependencies,
  };
  const useCase = new RegisterCurriculumPackUseCase({
    packRepo: deps.packRepo,
    clock: deps.clock,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    // Any signed-in teacher may register a pack or release a new Pack
    // Version of any non-system pack (ADR-0007).
    if (!event.account) {
      throw new UnauthorizedTokenError("An Account Token is required to register curriculum packs. Sign in first.");
    }

    const pack = (typeof event.body === "object" && event.body !== null)
      ? event.body as Record<string, unknown>
      : {};

    const result = await useCase.execute({
      pack: pack as never,
      accountId: event.account.accountId,
    });

    if (!result.success) {
      if (result.code === "PACK_ALREADY_EXISTS") {
        throw new PackAlreadyExistsError(result.packId, result.version);
      }
      throw new PackValidationFailedError(result.errors, result.warnings);
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

  return createApiHandler(rawHandler, {
    bearerScheme: "AccountAuth",
    accountTokenVerifier: deps.accountTokenVerifier,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey,
    tokenRequired: true,
    missingTokenMessage: "An Account Token is required to register curriculum packs. Sign in first.",
  });
}

export const lambdaHandler = createRegisterPackHandler();
