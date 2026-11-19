import type { AccountTokenSignerPort } from "./account-token.port.js";
import type { ClockPort } from "./clock.port.js";
import type { InstructorAccountRepositoryPort } from "./instructor-account-repository.port.js";
import type { PasswordHasherPort } from "./password-hasher.port.js";

export interface SignInInstructorCommand {
  readonly email: unknown;
  readonly password: unknown;
}

export interface SignInInstructorResult {
  readonly accountId: string;
  readonly email: string;
  readonly accountToken: string;
  readonly expiresAt: Date;
}

export interface SignInInstructorDependencies {
  readonly accountRepo: InstructorAccountRepositoryPort;
  readonly passwordHasher: PasswordHasherPort;
  readonly accountTokenSigner: AccountTokenSignerPort;
  readonly clock: ClockPort;
}

export interface SignInInstructorUseCasePort {
  execute: (command: SignInInstructorCommand) => Promise<SignInInstructorResult>;
}
