import type { MiddlewareObj } from "@middy/core";

export const INTERNAL_ERROR_BODY = {
  code: "INTERNAL_ERROR",
  message: "An unexpected error occurred.",
} as const;

/**
 * The last line of defence: any error no other middleware turned into a
 * response becomes a 500 with a generic message. The error and its stack are
 * logged on the server only, never sent to the caller.
 */
export function unexpectedErrorMiddleware(
  log: (message: string, error: unknown) => void = (message, error) => console.error(message, error),
): MiddlewareObj<any, any> {
  return {
    onError: async (request) => {
      if (request.response !== undefined) {
        return;
      }
      log("Unhandled error in API handler", request.error);
      request.response = {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(INTERNAL_ERROR_BODY),
      };
    },
  };
}
