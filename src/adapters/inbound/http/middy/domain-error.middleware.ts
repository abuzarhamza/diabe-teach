import type { MiddlewareObj } from "@middy/core";
import {
  AccountTemporarilyLockedError,
  AdjudicationLockedError,
  AssessmentAlreadySubmittedError,
  AssessmentIncompleteError,
  ChainAlreadySubmittedError,
  ChainNotFoundError,
  ChainTopologyInvalidError,
  ConcurrentUpdateConflictError,
  DomainError,
  EmailAlreadyRegisteredError,
  ForbiddenRoleError,
  InvalidAccountEmailError,
  InvalidAccountPasswordError,
  InvalidBoardSeedError,
  InvalidCredentialsError,
  InvalidPhaseTransitionError,
  InvalidSurveyResponseError,
  InvalidTimerConfigError,
  MalformedRequestBodyError,
  NotEnoughKeywordCardsError,
  PackAlreadyArchivedError,
  PackAlreadyExistsError,
  PackCannotFillBoardError,
  PackIsSystemPackError,
  PackNotArchivedError,
  PackNotFoundError,
  PackValidationFailedError,
  PhaseClosedForSubmissionsError,
  RoomCodeNotFoundError,
  SessionNotFoundError,
  SurveyAlreadySubmittedError,
  SurveyCommentsTooLongError,
  UnauthorizedTokenError,
} from "../../../../domain/errors/domain-errors.js";

export function domainErrorMiddleware(): MiddlewareObj<any, any> {
  return {
    onError: async (request) => {
      const { error } = request;

      if (error instanceof DomainError) {
        let statusCode = 500;
        if (
          error instanceof UnauthorizedTokenError
          || error instanceof InvalidCredentialsError
        ) {
          statusCode = 401;
        }
        else if (
          error instanceof InvalidTimerConfigError
          || error instanceof InvalidBoardSeedError
          || error instanceof MalformedRequestBodyError
          || error instanceof InvalidAccountEmailError
          || error instanceof InvalidAccountPasswordError
        ) {
          statusCode = 400;
        }
        else if (
          error instanceof PackNotFoundError
          || error instanceof SessionNotFoundError
          || error instanceof RoomCodeNotFoundError
        ) {
          statusCode = 404;
        }
        else if (
          error instanceof InvalidPhaseTransitionError
          || error instanceof PhaseClosedForSubmissionsError
          || error instanceof AdjudicationLockedError
          || error instanceof PackAlreadyArchivedError
          || error instanceof PackNotArchivedError
          || error instanceof PackAlreadyExistsError
          || error instanceof AssessmentAlreadySubmittedError
          || error instanceof SurveyAlreadySubmittedError
          || error instanceof ConcurrentUpdateConflictError
          || error instanceof ChainAlreadySubmittedError
          || error instanceof EmailAlreadyRegisteredError
        ) {
          statusCode = 409;
        }
        else if (
          error instanceof ForbiddenRoleError
          || error instanceof PackIsSystemPackError
        ) {
          statusCode = 403;
        }
        else if (error instanceof AccountTemporarilyLockedError) {
          statusCode = 423;
        }
        else if (error instanceof ChainNotFoundError) {
          statusCode = 404;
        }
        else if (
          error instanceof ChainTopologyInvalidError
          || error instanceof PackCannotFillBoardError
          || error instanceof PackValidationFailedError
          || error instanceof AssessmentIncompleteError
          || error instanceof SurveyCommentsTooLongError
          || error instanceof InvalidSurveyResponseError
          || error instanceof NotEnoughKeywordCardsError
        ) {
          statusCode = 422;
        }

        const payload = {
          code: error.code,
          message: error.message,
          ...(error.details
            ? { details: error.details }
            : {}),
        };

        request.response = {
          statusCode,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(payload),
        };
      }
    },
  };
}
