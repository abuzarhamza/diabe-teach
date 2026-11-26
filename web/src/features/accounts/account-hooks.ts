import type { StoredAccount } from "../../api/account-token-store.ts";
import type { InstructorAccountView } from "../../api/accounts-api.ts";
import type { ApiHttpError } from "../../api/http-client.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCurrentAccount, signInInstructor, signUpInstructor } from "../../api/accounts-api.ts";

// The only accounts file that uses TanStack Query. Screens call these hooks by what they do;
// each returns TanStack's result object: `mutate`, `isPending`, `error`, `data`, `reset`.

export interface Credentials {
  email: string;
  password: string;
}

// What the screen wants to happen after a send: the hook stays free of routing and focus.
export interface SendCallbacks {
  onSuccess: () => void;
  onError: (error: ApiHttpError) => void;
}

// How many times a failed GET /accounts/me is tried again (a 401 never is).
const MAX_RETRIES = 3;

// Sign in to an Instructor Account: POST /api/v1/accounts/sign-in. Stores the Account Token on success.
export function useSignIn({ onSuccess, onError }: SendCallbacks) {
  return useMutation<StoredAccount, ApiHttpError, Credentials>({
    // The call `mutate(credentials)` makes.
    mutationFn: ({ email, password }) => signInInstructor(email, password),
    // Runs once the API accepts the sign-in.
    onSuccess,
    // Runs once the API refuses it; `error` then holds the refusal for the screen.
    onError,
  });
}

// Create an Instructor Account: POST /api/v1/accounts. Signs the teacher in at once on success.
export function useCreateAccount({ onSuccess, onError }: SendCallbacks) {
  return useMutation<StoredAccount, ApiHttpError, Credentials>({
    // The call `mutate(credentials)` makes.
    mutationFn: ({ email, password }) => signUpInstructor(email, password),
    // Runs once the account exists and the teacher is signed in.
    onSuccess,
    // Runs once the API refuses it; `error` then holds the refusal for the screen.
    onError,
  });
}

// Confirms the signed-in teacher with GET /api/v1/accounts/me while a teacher screen shows.
export function useCurrentAccount(account: StoredAccount | null) {
  return useQuery<InstructorAccountView, ApiHttpError>({
    // The cache name. `accountId` is in it so a different teacher signing in is asked about afresh,
    // never shown the previous teacher's answer.
    queryKey: ["accounts", "me", account?.accountId],
    // The call that fetches the answer.
    queryFn: getCurrentAccount,
    // Ask only while someone is signed in; with no token there is nothing to confirm.
    enabled: account !== null,
    // Try again on a network or server failure, but not on 401: the token was refused and is already
    // cleared (http-client.ts), so asking again cannot succeed.
    retry: (failureCount, error) => error.status !== 401 && failureCount < MAX_RETRIES,
  });
}
