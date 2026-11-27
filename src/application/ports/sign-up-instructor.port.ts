import type { AccountTokenSignerPort } from "./account-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { IdGeneratorPort } from "./id-generator.port.js";
import type { InstructorAccountRepositoryPort } from "./instructor-account-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type { PasswordHasherPort } from "./password-hasher.port.js";

export interface SignUpInstructorCommand {
  readonly email: unknown;
  readonly password: unknown;
}

export interface SignUpInstructorResult {
  readonly accountId: string;
  readonly email: string;
  readonly accountToken: string;
  readonly expiresAt: Date;
}

export interface SignUpInstructorDependencies {
  readonly accountRepo: InstructorAccountRepositoryPort;
  readonly passwordHasher: PasswordHasherPort;
  readonly accountTokenSigner: AccountTokenSignerPort;
  readonly idGenerator: IdGeneratorPort;
  readonly clock: ClockPort;
}

export interface SignUpInstructorUseCasePort {
  execute: (command: SignUpInstructorCommand, logger?: LoggerPort) => Promise<SignUpInstructorResult>;
}
