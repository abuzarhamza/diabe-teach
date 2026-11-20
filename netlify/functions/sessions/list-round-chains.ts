import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { ListRoundChainsUseCase } from "../../../src/application/use-cases/list-round-chains.use-case.js";
import {
  ForbiddenRoleError,
  MalformedRequestBodyError,
  UnauthorizedTokenError,
} from "../../../src/domain/errors/domain-errors.js";

export interface ListRoundChainsHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

function parseRoundNumber(value: string): 1 | 2 {
  if (value === "1")
    return 1;
  if (value === "2")
    return 2;
  throw new MalformedRequestBodyError("roundNumber must be 1 or 2.", { roundNumber: value });
}

export function createListRoundChainsHandler(
  dependencies?: ListRoundChainsHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new ListRoundChainsUseCase({
    sessionRepo: deps.sessionRepo,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent & { auth?: VerifiedCapability },
  ): Promise<APIGatewayProxyResult> => {
    const sessionId = event.pathParameters?.sessionId;
    const roundNumberStr = event.pathParameters?.roundNumber;

    if (!sessionId || !roundNumberStr) {
      throw new UnauthorizedTokenError("Missing path parameters.");
    }

    if (!event.auth) {
      throw new UnauthorizedTokenError("Authentication required.");
    }

    if (event.auth.sessionId !== sessionId) {
      throw new ForbiddenRoleError(
        "Token session does not match requested session.",
      );
    }

    const result = await useCase.execute({
      sessionId,
      roundNumber: parseRoundNumber(roundNumberStr),
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
  }, "listRoundChains");
}

export const lambdaHandler = createListRoundChainsHandler();
