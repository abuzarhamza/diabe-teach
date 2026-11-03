import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenSignerPort } from "../../../src/application/ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { JoinGameSessionCommand } from "../../../src/application/ports/join-game-session.port.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
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
    const body = JSON.parse(event.body ?? "{}") as JoinGameSessionCommand;

    const result = await useCase.execute(body);

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
        tokenVerifier: undefined,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey ?? false,
      }),
    )
    .use(domainErrorMiddleware());
}

export const lambdaHandler = createJoinSessionHandler();
export default wrapLambdaHandler(lambdaHandler);
