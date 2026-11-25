// The Account Token store: the signed-in teacher's AccountTokenResponse, kept in localStorage.
// The key is the prototype's (claudPoc/concept-chain/account-api.js), so a teacher signed in there stays
// signed in here. It is the Account Token's own key: Capability Tokens are never kept under it (ADR-0007).

export const ACCOUNT_TOKEN_KEY = "cc-account-token-v1";

export interface StoredAccount {
  accountId: string;
  email: string;
  accountToken: string;
  expiresAt: string;
}

export function saveAccount(response: StoredAccount): StoredAccount {
  const account: StoredAccount = {
    accountId: response.accountId,
    email: response.email,
    accountToken: response.accountToken,
    expiresAt: response.expiresAt,
  };
  localStorage.setItem(ACCOUNT_TOKEN_KEY, JSON.stringify(account));
  return account;
}
