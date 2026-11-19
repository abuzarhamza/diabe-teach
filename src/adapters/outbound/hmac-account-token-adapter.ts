import type {
  AccountTokenSignerPort,
  AccountTokenVerifierPort,
  IssuedAccountToken,
  VerifiedAccount,
} from "../../application/ports/account-token.port.js";
import type { ClockPort } from "../../application/ports/clock.port.js";
import { jwtVerify, SignJWT } from "jose";
import { ACCOUNT_TOKEN_KIND } from "./token-kinds.js";

/**
 * Signs and verifies Account Tokens as HS256 JWTs (ADR-0004) with their own
 * secret, separate from the Capability Token secret. The `kind: "account"`
 * claim keeps a Capability Token from ever passing as an Account Token, even
 * if both secrets were set to the same value.
 */
export class HmacAccountTokenAdapter implements AccountTokenSignerPort, AccountTokenVerifierPort {
  public static readonly LIFETIME_SECONDS = 12 * 60 * 60;

  readonly #secretKey: Uint8Array;
  readonly #clock: ClockPort | undefined;

  /** `clock` decides expiry on verify; without it, the wall clock does. */
  public constructor(secret: string, clock?: ClockPort) {
    if (!secret || secret.trim().length === 0) {
      throw new Error("HmacAccountTokenAdapter requires a non-empty secret.");
    }
    this.#secretKey = new TextEncoder().encode(secret);
    this.#clock = clock;
  }

  public static fromSecret(
    secret: string | undefined,
    clock?: ClockPort,
  ): HmacAccountTokenAdapter | undefined {
    const trimmed = secret?.trim();
    return trimmed
      ? new HmacAccountTokenAdapter(trimmed, clock)
      : undefined;
  }

  public async signAccountToken(account: VerifiedAccount, issuedAt: Date): Promise<IssuedAccountToken> {
    const issuedAtSec = Math.floor(issuedAt.getTime() / 1000);
    const expiresAtSec = issuedAtSec + HmacAccountTokenAdapter.LIFETIME_SECONDS;
    const token = await new SignJWT({ kind: ACCOUNT_TOKEN_KIND, email: account.email })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(account.accountId)
      .setIssuedAt(issuedAtSec)
      .setExpirationTime(expiresAtSec)
      .sign(this.#secretKey);
    return {
      token,
      expiresAt: new Date(expiresAtSec * 1000),
    };
  }

  public async verifyAccountToken(token: string): Promise<VerifiedAccount | null> {
    try {
      const { payload } = await jwtVerify(token, this.#secretKey, {
        algorithms: ["HS256"],
        requiredClaims: ["exp", "sub"],
        ...(this.#clock
          ? {
              currentDate: this.#clock.now(),
            }
          : {}),
      });
      if (
        payload.kind !== ACCOUNT_TOKEN_KIND
        || typeof payload.sub !== "string"
        || payload.sub.length === 0
        || typeof payload.email !== "string"
      ) {
        return null;
      }
      return { accountId: payload.sub, email: payload.email };
    }
    catch {
      return null;
    }
  }
}
