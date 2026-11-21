import type { APIGatewayProxyResult } from "aws-lambda";
import type { AuthenticatedEvent } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import type { AccountTokenVerifierPort } from "../../../src/application/ports/account-token.port.js";
import type { CapabilityTokenSignerPort } from "../../../src/application/ports/capability-token.port.js";
import type { ClockPort } from "../../../src/application/ports/clock.port.js";
import type { CreateGameSessionCommand } from "../../../src/application/ports/create-game-session.port.js";
import type { CurriculumPackRepositoryPort } from "../../../src/application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import { readOptionalJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { requestLoggerOf } from "../../../src/adapters/inbound/http/request-logger.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { CreateGameSessionUseCase } from "../../../src/application/use-cases/create-game-session.use-case.js";

export interface CreateSessionHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
  readonly tokenVerifier?: unknown;
  /** Verifies the Account Token a classroom start needs (`AccountAuth`). */
  readonly accountTokenVerifier?: AccountTokenVerifierPort;
  readonly clock?: ClockPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createCreateSessionHandler(
  dependencies?: CreateSessionHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps: CreateSessionHandlerDependencies = dependencies ?? {
    packRepo: prodDeps.packRepo,
    sessionRepo: prodDeps.sessionRepo!,
    tokenSigner: prodDeps.tokenSigner!,
    tokenVerifier: prodDeps.tokenVerifier,
    accountTokenVerifier: prodDeps.accountTokenVerifier,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };
  const clock = deps.clock ?? prodDeps.clock!;
  const accountTokenVerifier = deps.accountTokenVerifier ?? prodDeps.accountTokenVerifier;

  const useCase = new CreateGameSessionUseCase({
    packRepo: deps.packRepo,
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenSigner,
    clock,
  });

  const rawHandler = async (
    event: AuthenticatedEvent,
  ): Promise<APIGatewayProxyResult> => {
    const body = readOptionalJsonObjectBody(event.body) as unknown as CreateGameSessionCommand;

    // A classroom start needs the teacher's Account Token (checked by the
    // use case); a solo start needs none. The response still carries the
    // per-session instructor Capability Token for every in-game route.
    const result = await useCase.execute({
      ...body,
      ownerAccountId: event.account?.accountId ?? null,
    }, requestLoggerOf(event));

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
    };
  };

  return createApiHandler(rawHandler, {
    bearerScheme: "AccountAuth",
    accountTokenVerifier,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey ?? false,
  }, "createGameSession");
}

export const lambdaHandler = createCreateSessionHandler();
