import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CapabilityTokenPort, VerifiedCapability } from "../../../src/application/ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "../../../src/application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../../../src/application/ports/game-session-repository.port.js";
import type { McqAnswerChoice } from "../../../src/domain/game-session/game-session.types.js";
import { readOptionalJsonObjectBody } from "../../../src/adapters/inbound/http/json-object-body.js";
import { createApiHandler } from "../../../src/adapters/inbound/http/middy/api-handler.js";
import { AppRuntime } from "../../../src/app-runtime.js";
import { SubmitAssessmentUseCase } from "../../../src/application/use-cases/submit-assessment.use-case.js";
import { ForbiddenRoleError, UnauthorizedTokenError } from "../../../src/domain/errors/domain-errors.js";

export interface SubmitAssessmentHandlerDependencies {
  readonly sessionRepo: GameSessionRepositoryPort;
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

interface SubmitAssessmentRequestBody {
  readonly answers: Record<string, McqAnswerChoice>;
}

export function createSubmitAssessmentHandler(
  dependencies?: SubmitAssessmentHandlerDependencies,
) {
  const prodDeps = AppRuntime.getProductionDependencies();
  const deps = dependencies ?? {
    sessionRepo: prodDeps.sessionRepo!,
    packRepo: prodDeps.packRepo,
    tokenVerifier: prodDeps.tokenVerifier!,
    apiKey: prodDeps.apiKey,
    requireApiKey: prodDeps.requireApiKey,
  };

  const useCase = new SubmitAssessmentUseCase({
    sessionRepo: deps.sessionRepo,
    packRepo: deps.packRepo,
  });

  const rawHandler = async (
    event: APIGatewayProxyEvent & { auth?: VerifiedCapability },
  ): Promise<APIGatewayProxyResult> => {
    const sessionId = event.pathParameters?.sessionId;
    const stage = event.pathParameters?.stage;

    if (!sessionId || !stage) {
      throw new UnauthorizedTokenError("Missing path parameters.");
    }

    if (stage !== "pretest" && stage !== "posttest") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          error: "INVALID_STAGE",
          message: "Stage must be 'pretest' or 'posttest'.",
        }),
      };
    }

    if (!event.auth) {
      throw new UnauthorizedTokenError("Authentication required.");
    }

    if (event.auth.sessionId !== sessionId) {
      throw new ForbiddenRoleError(
        "Token session does not match requested session.",
      );
    }

    const body = readOptionalJsonObjectBody(event.body) as Partial<SubmitAssessmentRequestBody>;

    if (!body.answers || typeof body.answers !== "object") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          error: "INVALID_REQUEST_BODY",
          message: "Request body must contain an 'answers' object.",
        }),
      };
    }

    const result = await useCase.execute({
      sessionId,
      stage,
      verifiedCapability: event.auth,
      answers: body.answers,
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

export const lambdaHandler = createSubmitAssessmentHandler();
