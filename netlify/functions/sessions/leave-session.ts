import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { ClockPort } from "../../../src/application/ports/clock.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { LeaveGameSessionUseCase } from "../../../src/application/use-cases/leave-game-session.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface LeaveSessionHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly clock?: ClockPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createLeaveSessionHandler(
  dependencies?: LeaveSessionHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps: LeaveSessionHandlerDependencies = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new LeaveGameSessionUseCase({
    sessionRepo: deps.sessionRepo,
    clock: deps.clock ?? prodDeps.clock!,
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

    // The operation takes no request body.
    const result = await useCase.execute({
      sessionId,
      verifiedCapability: event.auth,
    });

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
    requireApiKey: deps.requireApiKey ?? false,
    tokenRequired: true,
    missingTokenMessage: "Authentication required.",
  }, "leaveGameSession");
}

export const lambdaHandler = createLeaveSessionHandler();
