import type { InstructorAccountRepositoryPort } from "../../application/ports/instructor-account-repository.port.js";
import { EmailAlreadyRegisteredError } from "../../domain/errors/domain-errors.js";
import { InstructorAccount } from "../../domain/instructor-account/instructor-account.js";

/** Keeps copies of each account, and refuses a duplicate email like Mongo's unique index. */
export class InMemoryInstructorAccountRepository implements InstructorAccountRepositoryPort {
  readonly #accountsById = new Map<string, InstructorAccount>();
  readonly #accountIdsByEmail = new Map<string, string>();

  public async create(account: InstructorAccount): Promise<void> {
    if (this.#accountIdsByEmail.has(account.email)) {
      throw new EmailAlreadyRegisteredError();
    }
    this.#accountsById.set(account.accountId, InMemoryInstructorAccountRepository.#copy(account));
    this.#accountIdsByEmail.set(account.email, account.accountId);
  }

  public async findById(accountId: string): Promise<InstructorAccount | null> {
    const stored = this.#accountsById.get(accountId);
    return stored
      ? InMemoryInstructorAccountRepository.#copy(stored)
      : null;
  }

  public async findByEmail(email: string): Promise<InstructorAccount | null> {
    const accountId = this.#accountIdsByEmail.get(email);
    return accountId === undefined
      ? null
      : this.findById(accountId);
  }

  public async saveSignInCounters(account: InstructorAccount): Promise<void> {
    const stored = this.#accountsById.get(account.accountId);
    if (!stored) {
      return;
    }
    const { failedSignInCount, lockedUntil } = account.toProps();
    this.#accountsById.set(
      account.accountId,
      InstructorAccount.rehydrate({
        ...stored.toProps(),
        failedSignInCount,
        lockedUntil,
      }),
    );
  }

  public async recordFailedSignIn(accountId: string, now: Date): Promise<InstructorAccount | null> {
    // No await between the read and the write, so each call is atomic.
    const stored = this.#accountsById.get(accountId);
    if (!stored) {
      return null;
    }
    const account = InMemoryInstructorAccountRepository.#copy(stored);
    if (!account.isLockedAt(now)) {
      account.recordFailedSignIn(now);
      this.#accountsById.set(accountId, InMemoryInstructorAccountRepository.#copy(account));
    }
    return account;
  }

  /** Every stored record, as plain props: for tests that inspect storage. */
  public storedRecords(): ReadonlyArray<Readonly<Record<string, unknown>>> {
    return [
      ...this.#accountsById.values(),
    ].map(account => ({
      ...account.toProps(),
    }));
  }

  static #copy(account: InstructorAccount): InstructorAccount {
    return InstructorAccount.rehydrate(account.toProps());
  }
}
