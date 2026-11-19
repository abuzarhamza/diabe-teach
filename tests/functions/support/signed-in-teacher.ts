import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import type { CreateSessionHandlerDependencies } from "../../../netlify/functions/sessions/create-session.js";
import type { VerifiedAccount } from "../../../src/application/ports/account-token.port.js";
import { createCreateSessionHandler } from "../../../netlify/functions/sessions/create-session.js";
import { FakeAccountTokenAdapter } from "../../../src/adapters/outbound/fake-account-token-adapter.js";

export const TEST_TEACHER: VerifiedAccount = {
  accountId: "teacher-account-1",
  email: "teacher@example.edu",
};

export type CreateSessionTestHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

/**
 * The create-session handler as a signed-in teacher calls it: every request
 * that brings no Authorization header of its own gets the teacher's Account
 * Token, so classroom starts pass the Account Token check. Handler tests
 * that only need "some classroom session" use this instead of signing in
 * by hand.
 */
export function createSignedInCreateSessionHandler(
  dependencies: CreateSessionHandlerDependencies,
  teacher: VerifiedAccount = TEST_TEACHER,
): CreateSessionTestHandler {
  const accountTokens = new FakeAccountTokenAdapter();
  const signedIn = accountTokens.signAccountToken(teacher, new Date());
  const handler = createCreateSessionHandler({
    ...dependencies,
    accountTokenVerifier: accountTokens,
  });

  return async (event, context) => {
    const { token } = await signedIn;
    const headers = event.headers ?? {};
    const hasAuthorization = Object.keys(headers).some(name => name.toLowerCase() === "authorization");
    return handler(
      {
        ...event,
        headers: hasAuthorization
          ? headers
          : { ...headers, authorization: `Bearer ${token}` },
      },
      context,
    ) as Promise<APIGatewayProxyResult>;
  };
}
