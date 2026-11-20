import { InvalidAccountEmailError } from "../errors/domain-errors.js";

/**
 * An Instructor Account's email, trimmed and lower-cased, so
 * `Rahman.S@AKU.edu ` and `rahman.s@aku.edu` are the same account.
 */
export class AccountEmail {
  /** The longest address RFC 5321 allows. */
  public static readonly MAX_LENGTH = 254;

  // One "@", no spaces, and a dot in the domain part. A shape check only:
  // nobody verifies that the mailbox exists in the PoC.
  static readonly #SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  /** Normalises and checks a raw email; throws InvalidAccountEmailError. */
  public static parse(raw: unknown): AccountEmail {
    if (typeof raw !== "string") {
      throw new InvalidAccountEmailError();
    }
    const normalised = raw.trim().toLowerCase();
    if (normalised.length > AccountEmail.MAX_LENGTH || !AccountEmail.#SHAPE.test(normalised)) {
      throw new InvalidAccountEmailError();
    }
    return new AccountEmail(normalised);
  }

  /**
   * Normalises a raw email for a lookup without rejecting it, so sign-in with
   * a malformed email is just an unknown email.
   */
  public static normalise(raw: string): string {
    return raw.trim().toLowerCase();
  }
}
