import type { AccountTokenSignerPort } from "../ports/account-token.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { IdGeneratorPort } from "../ports/id-generator.port.js";
import type { InstructorAccountRepositoryPort } from "../ports/instructor-account-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { PasswordHasherPort } from "../ports/password-hasher.port.js";
import type {
  SignUpInstructorCommand,
  SignUpInstructorDependencies,
  SignUpInstructorResult,
  SignUpInstructorUseCasePort,
} from "../ports/sign-up-instructor.port.js";
import { EmailAlreadyRegisteredError } from "../../domain/errors/domain-errors.js";
import { AccountEmail } from "../../domain/instructor-account/account-email.js";
import { AccountPasswordPolicy } from "../../domain/instructor-account/account-password-policy.js";
import { InstructorAccount } from "../../domain/instructor-account/instructor-account.js";
import { SilentLogger } from "../services/silent-logger.js";

/**
 * Creates an Instructor Account from an email and a password and signs the
 * teacher straight in. No verification email in the PoC.
 */
export class SignUpInstructorUseCase implements SignUpInstructorUseCasePort {
  readonly #accountRepo: InstructorAccountRepositoryPort;
  readonly #passwordHasher: PasswordHasherPort;
  readonly #accountTokenSigner: AccountTokenSignerPort;
  readonly #idGenerator: IdGeneratorPort;
  readonly #clock: ClockPort;

  public constructor(deps: SignUpInstructorDependencies) {
    this.#accountRepo = deps.accountRepo;
    this.#passwordHasher = deps.passwordHasher;
    this.#accountTokenSigner = deps.accountTokenSigner;
    this.#idGenerator = deps.idGenerator;
    this.#clock = deps.clock;
  }

  public async execute(
    command: SignUpInstructorCommand,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<SignUpInstructorResult> {
    const email = AccountEmail.parse(command.email);
    const password = AccountPasswordPolicy.accept(command.password);

    // Checked before hashing to answer quickly; the repository's unique email
    // still refuses a sign-up that races this one.
    if (await this.#accountRepo.findByEmail(email.value)) {
      throw new EmailAlreadyRegisteredError();
    }

    const now = this.#clock.now();
    const account = InstructorAccount.register({
      accountId: this.#idGenerator.generate(),
      email: email.value,
      passwordHash: await this.#passwordHasher.hash(password),
      createdAt: now,
    });
    await this.#accountRepo.create(account);
    logger.info({ accountId: account.accountId }, "instructor signed up");

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
}
