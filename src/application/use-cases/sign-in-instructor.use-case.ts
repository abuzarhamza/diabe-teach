import type { AccountTokenSignerPort } from "../ports/account-token.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { InstructorAccountRepositoryPort } from "../ports/instructor-account-repository.port.js";
import type { PasswordHasherPort } from "../ports/password-hasher.port.js";
import type {
  SignInInstructorCommand,
  SignInInstructorDependencies,
  SignInInstructorResult,
  SignInInstructorUseCasePort,
} from "../ports/sign-in-instructor.port.js";
import { AccountTemporarilyLockedError, InvalidCredentialsError } from "../../domain/errors/domain-errors.js";
import { AccountEmail } from "../../domain/instructor-account/account-email.js";

/**
 * Signs a teacher in with an email and a password. An unknown email and a
 * wrong password both get InvalidCredentialsError, and both cost one hash
 * check, so neither the response nor its timing reveals which emails exist.
 *
 * Five wrong passwords in a row lock the account for 15 minutes (the
 * aggregate decides, using the clock port). While locked, every attempt gets
 * AccountTemporarilyLockedError, even with the right password. Unknown emails
 * never create records or counters.
 */
export class SignInInstructorUseCase implements SignInInstructorUseCasePort {
  /** Any password: its hash is checked when the email is unknown. */
  static readonly #TIMING_DECOY_PASSWORD = "decoy-password-for-unknown-emails";

  readonly #accountRepo: InstructorAccountRepositoryPort;
  readonly #passwordHasher: PasswordHasherPort;
  readonly #accountTokenSigner: AccountTokenSignerPort;
  readonly #clock: ClockPort;
  #decoyHash: Promise<string> | null = null;

  public constructor(deps: SignInInstructorDependencies) {
    this.#accountRepo = deps.accountRepo;
    this.#passwordHasher = deps.passwordHasher;
    this.#accountTokenSigner = deps.accountTokenSigner;
    this.#clock = deps.clock;
  }

  public async execute(command: SignInInstructorCommand): Promise<SignInInstructorResult> {
    if (typeof command.email !== "string" || typeof command.password !== "string") {
      throw new InvalidCredentialsError();
    }
    const password = command.password;
    const account = await this.#accountRepo.findByEmail(AccountEmail.normalise(command.email));

    if (!account) {
      await this.#passwordHasher.verify(await this.#getDecoyHash(), password);
      throw new InvalidCredentialsError();
    }

    const now = this.#clock.now();
    const lockEnd = account.activeLockEnd(now);
    if (lockEnd) {
      throw new AccountTemporarilyLockedError(lockEnd);
    }
    if (!(await this.#passwordHasher.verify(account.passwordHash, password))) {
      account.recordFailedSignIn(now);
      await this.#accountRepo.saveSignInCounters(account);
      const newLockEnd = account.activeLockEnd(now);
      if (newLockEnd) {
        throw new AccountTemporarilyLockedError(newLockEnd);
      }
      throw new InvalidCredentialsError();
    }
    if (account.hasSignInHistory) {
      account.recordSuccessfulSignIn();
      await this.#accountRepo.saveSignInCounters(account);
    }

    const issued = await this.#accountTokenSigner.signAccountToken(
      { accountId: account.accountId, email: account.email },
      now,
    );
    return {
      accountId: account.accountId,
      email: account.email,
      accountToken: issued.token,
      expiresAt: issued.expiresAt,
    };
  }

  #getDecoyHash(): Promise<string> {
    this.#decoyHash ??= this.#passwordHasher.hash(SignInInstructorUseCase.#TIMING_DECOY_PASSWORD);
    return this.#decoyHash;
  }
}
