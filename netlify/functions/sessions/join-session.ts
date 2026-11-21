import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenSignerPort } from "../../../src/application/ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { JoinGameSessionCommand } from "../../../src/application/ports/join-game-session.port.js";
import { readOptionalJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { requestLoggerOf } from "../../../src/adapters/inbound/http/request-logger.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { JoinGameSessionUseCase } from "../../../src/application/use-cases/join-game-session.use-case.js";

export interface JoinSessionHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
  readonly tokenVerifier?: unknown;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createJoinSessionHandler(
  dependencies?: JoinSessionHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenSigner: prodDeps.tokenSigner!,
    tokenVerifier: prodDeps.tokenVerifier,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new JoinGameSessionUseCase({
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenSigner,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const body = readOptionalJsonObjectBody(event.body) as unknown as JoinGameSessionCommand;

    const result = await useCase.execute(body, requestLoggerOf(event));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(result),
    };
  };

  return createApiHandler(rawHandler, {
    tokenVerifier: undefined,
    apiKey: deps.apiKey,
    requireApiKey: deps.requireApiKey ?? false,
  }, "joinGameSession");
}

export const lambdaHandler = createJoinSessionHandler();
