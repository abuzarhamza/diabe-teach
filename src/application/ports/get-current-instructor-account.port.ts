import type { InstructorAccountRepositoryPort } from "./instructor-account-repository.port.js";

export interface GetCurrentInstructorAccountQuery {
  /** From a verified Account Token. */
  readonly accountId: string;
}

export interface GetCurrentInstructorAccountResult {
  readonly accountId: string;
  readonly email: string;
  readonly createdAt: Date;
}

export interface GetCurrentInstructorAccountDependencies {
  readonly accountRepo: InstructorAccountRepositoryPort;
}

export interface GetCurrentInstructorAccountUseCasePort {
  execute: (query: GetCurrentInstructorAccountQuery) => Promise<GetCurrentInstructorAccountResult>;
}
