import type { MiddlewareObj } from "@middy/core";
import {
  AdjudicationLockedError,
  ChainNotFoundError,
  ChainTopologyInvalidError,
  DomainError,
  ForbiddenRoleError,
  InvalidPhaseTransitionError,
  PackAlreadyArchivedError,
  PackAlreadyExistsError,
  PackIsSystemPackError,
  PackNotArchivedError,
  PackNotFoundError,
  PhaseClosedForSubmissionsError,
  RoomCodeNotFoundError,
  SessionNotFoundError,
  UnauthorizedTokenError,
} from "../../../../domain/errors/domain-errors.js";

export function domainErrorMiddleware(): MiddlewareObj<any, any> {
  return {
    onError: async (request) => {
      const { error } = request;

      if (error instanceof DomainError) {
        let statusCode = 500;
        if (error instanceof UnauthorizedTokenError) {
          statusCode = 401;
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
        ) {
          statusCode = 409;
        }
        else if (
          error instanceof ForbiddenRoleError
          || error instanceof PackIsSystemPackError
        ) {
          statusCode = 403;
        }
        else if (error instanceof ChainNotFoundError) {
          statusCode = 404;
        }
        else if (error instanceof ChainTopologyInvalidError) {
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
