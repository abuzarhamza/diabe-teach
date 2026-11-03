import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { AdjudicateConceptChainCommand } from "../../../src/application/ports/adjudicate-concept-chain.port.js";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import middy from "@middy/core";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { AdjudicateConceptChainUseCase } from "../../../src/application/use-cases/adjudicate-concept-chain.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface AdjudicateChainHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createAdjudicateChainHandler(
  dependencies?: AdjudicateChainHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new AdjudicateConceptChainUseCase({
    sessionRepo: deps.sessionRepo,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent & { auth?: VerifiedCapability },
  ): Promise<APIGatewayProxyResult> => {
    const sessionId = event.pathParameters?.sessionId;
    const roundNumberStr = event.pathParameters?.roundNumber;
    const chainId = event.pathParameters?.chainId;

    if (!sessionId || !roundNumberStr || !chainId) {
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

    const roundNumber = Number.parseInt(roundNumberStr, 10) as 1 | 2;
    const body = JSON.parse(event.body ?? "{}") as Partial<AdjudicateConceptChainCommand>;

    const result = await useCase.execute({
      sessionId,
      roundNumber,
      chainId,
      verifiedCapability: event.auth,
      action: body.action ?? "peer-approve",
      comment: body.comment,
      feedback: body.feedback,
      qualityScore: body.qualityScore,
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

export const lambdaHandler = createAdjudicateChainHandler();
export default wrapLambdaHandler(lambdaHandler);
