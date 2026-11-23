import type { InstructorAccount } from "../../domain/instructor-account/instructor-account.js";

export interface InstructorAccountRepositoryPort {
  /**
   * Stores a new account. Throws EmailAlreadyRegisteredError when another
   * account already has the same (normalised) email.
   */
  create: (account: InstructorAccount) => Promise<void>;
  findById: (accountId: string) => Promise<InstructorAccount | null>;
  /** Looks up by an already-normalised (trimmed, lower-cased) email. */
  findByEmail: (email: string) => Promise<InstructorAccount | null>;
  /**
   * Stores an existing account's sign-in counters (failed sign-in count and
   * lock-until time). Nothing else about the account changes.
   */
  saveSignInCounters: (account: InstructorAccount) => Promise<void>;
}
