// The Instructor Account routes (docs/api/openapi.yaml, /api/v1/accounts/*).
import type { StoredAccount } from "./account-token-store.ts";
import { saveAccount } from "./account-token-store.ts";
import { apiRequest } from "./http-client.ts";

export type AccountTokenResponse = StoredAccount;

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
