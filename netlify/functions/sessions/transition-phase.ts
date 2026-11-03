import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { TransitionSessionPhaseCommand } from "../../../src/application/ports/transition-session-phase.port.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { TransitionSessionPhaseUseCase } from "../../../src/application/use-cases/transition-session-phase.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface TransitionPhaseHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createTransitionPhaseHandler(
  dependencies?: TransitionPhaseHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new TransitionSessionPhaseUseCase({
    sessionRepo: deps.sessionRepo,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent & { auth?: VerifiedCapability },
  ): Promise<APIGatewayProxyResult> => {
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      throw new UnauthorizedTokenError("Missing sessionId parameter.");
    }

    if (!event.auth) {
      throw new UnauthorizedTokenError("Authentication required.");
    }

    if (event.auth.sessionId !== sessionId) {
      throw new ForbiddenRoleError(
        "Token session does not match requested session.",
      );
    }

    const body = JSON.parse(event.body ?? "{}") as Partial<TransitionSessionPhaseCommand>;

    const result = await useCase.execute({
      sessionId,
      verifiedCapability: event.auth,
      action: body.action ?? "advance",
      targetPhase: body.targetPhase,
      seed: body.seed,
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
    .use(
      authMiddleware({
        tokenVerifier: deps.tokenVerifier,
        apiKey: deps.apiKey,
        requireApiKey: deps.requireApiKey ?? false,
      }),
    )
    .use(domainErrorMiddleware());
}

export const lambdaHandler = createTransitionPhaseHandler();
export default wrapLambdaHandler(lambdaHandler);
