import type { MiddlewareObj } from "@middy/core";
import { DomainError, PackNotFoundError, UnauthorizedTokenError } from "../../../../domain/errors/domain-errors.js";

export function domainErrorMiddleware(): MiddlewareObj<any, any> {
  return {
    onError: async (request) => {
      const { error } = request;

      if (error instanceof DomainError) {
        let statusCode = 500;
        if (error instanceof UnauthorizedTokenError) {
          statusCode = 401;
        }
        else if (error instanceof PackNotFoundError) {
          statusCode = 404;
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
