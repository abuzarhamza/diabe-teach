// The Instructor Account routes (docs/api/openapi.yaml, /api/v1/accounts/*).
import type { StoredAccount } from "./account-token-store.ts";
import { accountFromSnapshot, readStoredAccountSnapshot, saveAccount } from "./account-token-store.ts";
import { ApiHttpError, apiRequest } from "./http-client.ts";

export type AccountTokenResponse = StoredAccount;

export interface InstructorAccountView {
  accountId: string;
  email: string;
  createdAt: string;
}

// POST /api/v1/accounts/sign-in (200). The email is trimmed here; the server lower-cases it.
// The returned Account Token is saved, so the teacher stays signed in after a reload.
export async function signInInstructor(email: string, password: string): Promise<StoredAccount> {
  const response = await apiRequest<AccountTokenResponse>("POST", "/api/v1/accounts/sign-in", {
    body: {
      email: email.trim(),
      password,
    },
  });
  return saveAccount(response);
}

// POST /api/v1/accounts/sign-up (201): creates the Instructor Account and signs it in at once.
// The email is trimmed here; the server lower-cases it. The returned Account Token is saved.
export async function signUpInstructor(email: string, password: string): Promise<StoredAccount> {
  const response = await apiRequest<AccountTokenResponse>("POST", "/api/v1/accounts/sign-up", {
    body: {
      email: email.trim(),
      password,
    },
  });
  return saveAccount(response);
}

// GET /api/v1/accounts/me (200) with the stored Account Token: confirms the server still accepts it.
// A 401 clears the token and leaves the "not accepted" reason for the Login screen (http-client.ts).
export async function getCurrentAccount(): Promise<InstructorAccountView> {
  const account = accountFromSnapshot(readStoredAccountSnapshot());
  if (!account)
    throw new ApiHttpError(401, "UNAUTHORIZED_TOKEN", "Sign in to continue.");
  return apiRequest<InstructorAccountView>("GET", "/api/v1/accounts/me", {
    auth: { kind: "account", token: account.accountToken },
  });
}
