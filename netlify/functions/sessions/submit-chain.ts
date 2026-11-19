import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { ClockPort } from "../../../src/application/ports/clock.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { SubmitConceptChainCommand } from "../../../src/application/ports/submit-concept-chain.port.js";
import { readOptionalJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { wrapLambdaHandler } from "../../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { SubmitConceptChainUseCase } from "../../../src/application/use-cases/submit-concept-chain.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface SubmitChainHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly clock?: ClockPort;
  readonly minChainLength?: number;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createSubmitChainHandler(
  dependencies?: SubmitChainHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps: SubmitChainHandlerDependencies = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };
  const clock = deps.clock ?? prodDeps.clock!;

  const useCase = new SubmitConceptChainUseCase({
    sessionRepo: deps.sessionRepo,
    clock,
    minChainLength: deps.minChainLength,
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

    const roundNumber = Number.parseInt(roundNumberStr, 10) as 1 | 2;
    const body = readOptionalJsonObjectBody(event.body) as Partial<SubmitConceptChainCommand>;

    const result = await useCase.execute({
      sessionId,
      roundNumber,
      verifiedCapability: event.auth,
      path: body.path ?? [],
      keywordIds: body.keywordIds ?? [],
      narrativeExplanation: body.narrativeExplanation ?? "",
      stepRationales: body.stepRationales,
    });

    return {
      statusCode: 201,
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
  });
}

export const lambdaHandler = createSubmitChainHandler();
export default wrapLambdaHandler(lambdaHandler);
