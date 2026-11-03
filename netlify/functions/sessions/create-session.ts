import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenSignerPort } from "../../../src/application/ports/capability-token.port.js";
import type { CreateGameSessionCommand } from "../../../src/application/ports/create-game-session.port.js";
import type { CurriculumPackRepositoryPort } from "../../../src/application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { CreateGameSessionUseCase } from "../../../src/application/use-cases/create-game-session.use-case.js";

export interface CreateSessionHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenSigner: CapabilityTokenSignerPort;
  readonly tokenVerifier?: unknown;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createCreateSessionHandler(
  dependencies?: CreateSessionHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    packRepo: prodDeps.packRepo,
    sessionRepo: prodDeps.sessionRepo!,
    tokenSigner: prodDeps.tokenSigner!,
    tokenVerifier: prodDeps.tokenVerifier,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new CreateGameSessionUseCase({
    packRepo: deps.packRepo,
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenSigner,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const body = JSON.parse(event.body ?? "{}") as CreateGameSessionCommand;

    const result = await useCase.execute(body);

    return {
      statusCode: 201,
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

export const lambdaHandler = createCreateSessionHandler();
export default wrapLambdaHandler(lambdaHandler);
