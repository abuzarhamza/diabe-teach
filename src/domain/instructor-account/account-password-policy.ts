import { InvalidAccountPasswordError } from "../errors/domain-errors.js";

/**
 * The only password rule: at least 10 characters. The upper limit just caps
 * how much text the server will hash.
 */
export class AccountPasswordPolicy {
  public static readonly MIN_LENGTH = 10;
  public static readonly MAX_LENGTH = 1024;

  /** Returns the password unchanged if acceptable; throws InvalidAccountPasswordError. */
  public static accept(raw: unknown): string {
    if (
      typeof raw !== "string"
      || raw.length < AccountPasswordPolicy.MIN_LENGTH
      || raw.length > AccountPasswordPolicy.MAX_LENGTH
    ) {
      throw new InvalidAccountPasswordError(
        AccountPasswordPolicy.MIN_LENGTH,
        AccountPasswordPolicy.MAX_LENGTH,
      );
    }
    return raw;
  }
}
