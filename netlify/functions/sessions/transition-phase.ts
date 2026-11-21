import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { BoardSeedGeneratorPort, SeededRandomPort } from "../../../src/application/ports/board-randomness.port.js";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { ClockPort } from "../../../src/application/ports/clock.port.js";
import type { CurriculumPackRepositoryPort } from "../../../src/application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { TransitionSessionPhaseCommand } from "../../../src/application/ports/transition-session-phase.port.js";
import { readOptionalJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { requestLoggerOf } from "../../../src/adapters/inbound/http/request-logger.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { TransitionSessionPhaseUseCase } from "../../../src/application/use-cases/transition-session-phase.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface TransitionPhaseHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  /** Supplies the session's Curriculum Pack when a round's board is dealt. */
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly clock?: ClockPort;
  readonly seededRandom?: SeededRandomPort;
  readonly seedGenerator?: BoardSeedGeneratorPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export function createTransitionPhaseHandler(
  dependencies?: TransitionPhaseHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps: TransitionPhaseHandlerDependencies = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    packRepo: prodDeps.packRepo,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };
  const clock = deps.clock ?? prodDeps.clock!;

  const useCase = new TransitionSessionPhaseUseCase({
    sessionRepo: deps.sessionRepo,
    packRepo: deps.packRepo,
    clock,
    seededRandom: deps.seededRandom ?? prodDeps.seededRandom!,
    seedGenerator: deps.seedGenerator ?? prodDeps.seedGenerator!,
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

    // The request schema has already required a known `action` (api-hardening 06).
    const body = readOptionalJsonObjectBody(event.body) as Pick<TransitionSessionPhaseCommand, "action" | "targetPhase" | "seed">;

    const result = await useCase.execute({
      sessionId,
      verifiedCapability: event.auth,
      action: body.action,
      targetPhase: body.targetPhase,
      seed: body.seed,
    }, requestLoggerOf(event));

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
  }, "transitionSessionPhase");
}

export const lambdaHandler = createTransitionPhaseHandler();
