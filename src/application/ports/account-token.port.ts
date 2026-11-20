/** The identity an Account Token proves. Not tied to any Game Session. */
export interface VerifiedAccount {
  readonly accountId: string;
  readonly email: string;
}

export interface IssuedAccountToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AccountTokenSignerPort {
  /** Issues an Account Token valid for 12 hours from `issuedAt`. */
  signAccountToken: (account: VerifiedAccount, issuedAt: Date) => Promise<IssuedAccountToken>;
}

export interface AccountTokenVerifierPort {
  /**
   * The account a token proves, or null for a malformed, tampered or expired
   * token, or for any token that is not an Account Token (such as a
   * Capability Token).
   */
  verifyAccountToken: (token: string) => Promise<VerifiedAccount | null>;
}
