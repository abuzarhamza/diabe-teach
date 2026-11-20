import type {
  AccountTokenSignerPort,
  AccountTokenVerifierPort,
  IssuedAccountToken,
  VerifiedAccount,
} from "../../application/ports/account-token.port.js";

/**
 * In-memory Account Tokens for tests and for local development without an
 * Account Token secret. Tokens never expire and only this instance knows them.
 */
export class FakeAccountTokenAdapter implements AccountTokenSignerPort, AccountTokenVerifierPort {
  readonly #tokens = new Map<string, VerifiedAccount>();
  #tokenCounter = 0;

  public async signAccountToken(account: VerifiedAccount, issuedAt: Date): Promise<IssuedAccountToken> {
    const token = `fake-account-token-${++this.#tokenCounter}`;
    this.#tokens.set(token, { accountId: account.accountId, email: account.email });
    return {
      token,
      expiresAt: new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000),
    };
  }

  public async verifyAccountToken(token: string): Promise<VerifiedAccount | null> {
    return this.#tokens.get(token) ?? null;
  }
}
