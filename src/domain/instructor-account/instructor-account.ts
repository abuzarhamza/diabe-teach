import type {
  InstructorAccountProps,
  RegisterInstructorAccountInput,
} from "./instructor-account.types.js";
import { AccountEmail } from "./account-email.js";

/**
 * A teacher's persistent identity: an email and a password (kept only as a
 * hash). Aggregate Root for sign-up and sign-in.
 */
export class InstructorAccount {
  /** Wrong passwords in a row that lock the account. */
  public static readonly MAX_FAILED_SIGN_INS = 5;
  /** How long a lock lasts. */
  public static readonly LOCK_DURATION_MS = 15 * 60 * 1000;

  #props: InstructorAccountProps;

  private constructor(props: InstructorAccountProps) {
    this.#props = { ...props };
  }

  /** A new account with no failed sign-ins and no lock. */
  public static register(input: RegisterInstructorAccountInput): InstructorAccount {
    return new InstructorAccount({
      accountId: input.accountId,
      email: AccountEmail.parse(input.email).value,
      passwordHash: input.passwordHash,
      failedSignInCount: 0,
      lockedUntil: null,
      createdAt: input.createdAt,
    });
  }

  /** Restores an account exactly as stored. */
  public static rehydrate(props: InstructorAccountProps): InstructorAccount {
    return new InstructorAccount(props);
  }

  public get accountId(): string {
    return this.#props.accountId;
  }

  public get email(): string {
    return this.#props.email;
  }

  public get passwordHash(): string {
    return this.#props.passwordHash;
  }

  public get failedSignInCount(): number {
    return this.#props.failedSignInCount;
  }

  public get lockedUntil(): Date | null {
    return this.#props.lockedUntil;
  }

  public get createdAt(): Date {
    return this.#props.createdAt;
  }

  /**
   * The name shown as a Pack Version's author: the part of the email before
   * the @ (`rahman.s` for `rahman.s@aku.edu`). Worked out on every read and
   * never stored, so it always follows the account's email.
   */
  public get authorHandle(): string {
    const email = this.#props.email;
    const at = email.lastIndexOf("@");
    return at > 0
      ? email.slice(0, at)
      : email;
  }

  /** True while a lock is in force at `now`; sign-in must be refused. */
  public isLockedAt(now: Date): boolean {
    return this.activeLockEnd(now) !== null;
  }

  /** When the lock in force at `now` ends, or null when sign-in is allowed. */
  public activeLockEnd(now: Date): Date | null {
    const { lockedUntil } = this.#props;
    return lockedUntil !== null && lockedUntil.getTime() > now.getTime()
      ? lockedUntil
      : null;
  }

  /**
   * Records a wrong password at `now`. The fifth in a row locks the account
   * for 15 minutes and starts the count again, so another lock needs five
   * more wrong passwords after this one ends.
   */
  public recordFailedSignIn(now: Date): void {
    const failedSignInCount = this.#props.failedSignInCount + 1;
    if (failedSignInCount >= InstructorAccount.MAX_FAILED_SIGN_INS) {
      this.#props = {
        ...this.#props,
        failedSignInCount: 0,
        lockedUntil: new Date(now.getTime() + InstructorAccount.LOCK_DURATION_MS),
      };
      return;
    }
    this.#props = {
      ...this.#props,
      failedSignInCount,
      lockedUntil: this.isLockedAt(now)
        ? this.#props.lockedUntil
        : null,
    };
  }

  /** A successful sign-in clears the wrong-password count and any ended lock. */
  public recordSuccessfulSignIn(): void {
    this.#props = { ...this.#props, failedSignInCount: 0, lockedUntil: null };
  }

  /** True when the sign-in counters differ from a fresh, unlocked account's. */
  public get hasSignInHistory(): boolean {
    return this.#props.failedSignInCount !== 0 || this.#props.lockedUntil !== null;
  }

  public toProps(): InstructorAccountProps {
    return { ...this.#props };
  }
}
