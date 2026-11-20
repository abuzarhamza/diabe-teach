import type { InstructorAccountRepositoryPort } from "../../src/application/ports/instructor-account-repository.port.js";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { MongoInstructorAccountRepository } from "../../src/adapters/outbound/mongo-instructor-account-repository.js";
import { EmailAlreadyRegisteredError } from "../../src/domain/errors/domain-errors.js";
import { InstructorAccount } from "../../src/domain/instructor-account/instructor-account.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

const PLAIN_PASSWORD = "correct horse battery";

interface RepositoryHarness {
  readonly repo: InstructorAccountRepositoryPort;
  /** Every stored record exactly as the storage holds it. */
  readonly rawRecords: () => Promise<ReadonlyArray<unknown>>;
}

let accountCounter = 0;

async function newAccount(email: string): Promise<InstructorAccount> {
  return InstructorAccount.register({
    accountId: `account-${++accountCounter}`,
    email,
    passwordHash: await new Argon2PasswordHasher().hash(PLAIN_PASSWORD),
    createdAt: new Date("2026-11-19T08:00:00.000Z"),
  });
}

function defineInstructorAccountRepositoryContract(
  name: string,
  setup: () => Promise<RepositoryHarness>,
  teardown: () => Promise<void> = async () => {},
): void {
  describe(`${name} (instructor account repository contract)`, () => {
    let harness: RepositoryHarness;

    beforeAll(async () => {
      harness = await setup();
    }, 60_000);

    afterAll(async () => {
      await teardown();
    });

    it("finds a created account by id and by email with every field intact", async () => {
      const account = await newAccount(`round-trip-${name}@aku.edu`);

      await harness.repo.create(account);
      const byId = await harness.repo.findById(account.accountId);
      const byEmail = await harness.repo.findByEmail(account.email);

      expect(byId?.toProps()).toEqual(account.toProps());
      expect(byEmail?.toProps()).toEqual(account.toProps());
      expect(byId?.failedSignInCount).toBe(0);
      expect(byId?.lockedUntil).toBeNull();
    });

    it("returns null for an unknown id or email", async () => {
      expect(await harness.repo.findById("no-such-account")).toBeNull();
      expect(await harness.repo.findByEmail("nobody@aku.edu")).toBeNull();
    });

    it("refuses a second account with the same email and keeps the first", async () => {
      const first = await newAccount(`duplicate-${name}@aku.edu`);
      // Normalised by the aggregate to the same email as `first`.
      const second = await newAccount(`  DUPLICATE-${name}@AKU.edu `);
      await harness.repo.create(first);

      await expect(harness.repo.create(second)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
      expect((await harness.repo.findByEmail(first.email))?.accountId).toBe(first.accountId);
      expect(await harness.repo.findById(second.accountId)).toBeNull();
    });

    it("round-trips the failed sign-in count and lock-until time", async () => {
      const account = await newAccount(`counters-${name}@aku.edu`);
      await harness.repo.create(account);
      const now = new Date("2026-11-19T09:00:00.000Z");

      for (let attempt = 0; attempt < 3; attempt++) {
        account.recordFailedSignIn(now);
      }
      await harness.repo.saveSignInCounters(account);
      const counted = await harness.repo.findById(account.accountId);
      expect(counted?.failedSignInCount).toBe(3);
      expect(counted?.lockedUntil).toBeNull();

      account.recordFailedSignIn(now);
      account.recordFailedSignIn(now);
      await harness.repo.saveSignInCounters(account);
      const locked = await harness.repo.findByEmail(account.email);
      expect(locked?.lockedUntil?.toISOString()).toBe("2026-11-19T09:15:00.000Z");
      expect(locked?.isLockedAt(now)).toBe(true);
      expect(locked?.toProps()).toEqual(account.toProps());

      account.recordSuccessfulSignIn();
      await harness.repo.saveSignInCounters(account);
      const cleared = await harness.repo.findById(account.accountId);
      expect(cleared?.failedSignInCount).toBe(0);
      expect(cleared?.lockedUntil).toBeNull();
      expect(cleared?.toProps()).toEqual(account.toProps());
    });

    it("counts every one of four concurrent failed attempts", async () => {
      const account = await newAccount(`concurrent-four-${name}@aku.edu`);
      await harness.repo.create(account);
      const now = new Date("2026-11-19T09:00:00.000Z");

      await Promise.all(
        Array.from({ length: 4 }, async () => harness.repo.recordFailedSignIn(account.accountId, now)),
      );

      const stored = await harness.repo.findById(account.accountId);
      expect(stored?.failedSignInCount).toBe(4);
      expect(stored?.lockedUntil).toBeNull();
    });

    it("five concurrent failed attempts are all counted and give exactly one 15-minute lock", async () => {
      const account = await newAccount(`concurrent-five-${name}@aku.edu`);
      await harness.repo.create(account);
      const now = new Date("2026-11-19T09:00:00.000Z");

      const results = await Promise.all(
        Array.from({ length: 5 }, async () => harness.repo.recordFailedSignIn(account.accountId, now)),
      );

      // Each attempt saw its own count (1 to 4), and exactly one (the fifth)
      // set the lock and restarted the count: none lost, none doubled.
      expect(results.map(result => result?.failedSignInCount).sort()).toEqual([0, 1, 2, 3, 4]);
      expect(results.filter(result => result?.isLockedAt(now))).toHaveLength(1);
      const stored = await harness.repo.findById(account.accountId);
      expect(stored?.lockedUntil?.toISOString()).toBe("2026-11-19T09:15:00.000Z");
      expect(stored?.failedSignInCount).toBe(0);
    });

    it("does not count a failed attempt while locked, nor extend the lock", async () => {
      const account = await newAccount(`while-locked-${name}@aku.edu`);
      await harness.repo.create(account);
      const now = new Date("2026-11-19T09:00:00.000Z");
      for (let attempt = 0; attempt < 5; attempt++) {
        await harness.repo.recordFailedSignIn(account.accountId, now);
      }

      const later = new Date("2026-11-19T09:10:00.000Z");
      const result = await harness.repo.recordFailedSignIn(account.accountId, later);

      expect(result?.lockedUntil?.toISOString()).toBe("2026-11-19T09:15:00.000Z");
      expect(result?.failedSignInCount).toBe(0);
      const afterLock = await harness.repo.recordFailedSignIn(
        account.accountId,
        new Date("2026-11-19T09:15:00.000Z"),
      );
      expect(afterLock?.failedSignInCount).toBe(1);
      expect(afterLock?.lockedUntil).toBeNull();
    });

    it("records nothing for an unknown account", async () => {
      expect(await harness.repo.recordFailedSignIn("no-such-account", new Date())).toBeNull();
    });

    it("never stores the plain password", async () => {
      const account = await newAccount(`no-plain-${name}@aku.edu`);

      await harness.repo.create(account);

      const records = await harness.rawRecords();
      expect(records.length).toBeGreaterThan(0);
      expect(JSON.stringify(records)).not.toContain(PLAIN_PASSWORD);
    });
  });
}

defineInstructorAccountRepositoryContract("inMemoryInstructorAccountRepository", async () => {
  const repo = new InMemoryInstructorAccountRepository();
  return {
    repo,
    rawRecords: async () => repo.storedRecords(),
  };
});

defineInstructorAccountRepositoryContract(
  "mongoInstructorAccountRepository",
  async () => {
    const mongoUri = await startMongoTestServer();
    const mongoDbName = "instructor-account-contract";
    return {
      repo: MongoInstructorAccountRepository.fromConfig({ mongoUri, mongoDbName }),
      rawRecords: async () => {
        const connection = await mongoose.createConnection(mongoUri, { dbName: mongoDbName }).asPromise();
        try {
          return await connection.collection(MongoInstructorAccountRepository.collectionName).find({}).toArray();
        }
        finally {
          await connection.close();
        }
      },
    };
  },
  stopMongoTestServer,
);
