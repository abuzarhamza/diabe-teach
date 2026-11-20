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
  /**
   * Records one wrong password at `now` as a single atomic update on the
   * stored account (the aggregate's rule: the fifth in a row locks it for 15
   * minutes and restarts the count). Does nothing while a lock is in force at
   * `now`, so concurrent attempts are never lost and never lock twice.
   * Returns the account as stored afterwards, or null when there is none.
   */
  recordFailedSignIn: (accountId: string, now: Date) => Promise<InstructorAccount | null>;
}
