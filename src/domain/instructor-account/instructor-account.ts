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
  readonly #props: InstructorAccountProps;

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

  public toProps(): InstructorAccountProps {
    return { ...this.#props };
  }
}
