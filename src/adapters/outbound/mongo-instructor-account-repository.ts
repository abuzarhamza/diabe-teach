import type { Connection, Model } from "mongoose";
import type { InstructorAccountRepositoryPort } from "../../application/ports/instructor-account-repository.port.js";
import type { LoggerPort } from "../../application/ports/logger.port.js";
import type {
  InstructorAccountCollectionLike,
  InstructorAccountDocument,
  MongoInstructorAccountConnectionConfig,
  MongoInstructorAccountRepositoryOptions,
} from "./mongo-instructor-account-repository.types.js";
import { SilentLogger } from "../../application/services/silent-logger.js";
import { EmailAlreadyRegisteredError } from "../../domain/errors/domain-errors.js";
import { InstructorAccount } from "../../domain/instructor-account/instructor-account.js";
import { DEFAULT_MONGODB_DB_NAME } from "./curriculum-pack.schema.js";
import {
  INSTRUCTOR_ACCOUNT_MODEL_NAME,
  INSTRUCTOR_ACCOUNTS_COLLECTION,
  instructorAccountSchema,
} from "./instructor-account.schema.js";
import { MongoConnectionManager } from "./mongo-client-singleton.js";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export class MongoInstructorAccountRepository implements InstructorAccountRepositoryPort {
  public static readonly modelName = INSTRUCTOR_ACCOUNT_MODEL_NAME;
  public static readonly collectionName = INSTRUCTOR_ACCOUNTS_COLLECTION;

  readonly #getCollection: () => Promise<InstructorAccountCollectionLike>;

  public constructor(options: MongoInstructorAccountRepositoryOptions) {
    this.#getCollection = options.getCollection;
  }

  public static getModel(connection: Connection): Model<InstructorAccountDocument> {
    return (
      (connection.models[INSTRUCTOR_ACCOUNT_MODEL_NAME] as
      | Model<InstructorAccountDocument>
      | undefined)
    ?? connection.model<InstructorAccountDocument>(
      INSTRUCTOR_ACCOUNT_MODEL_NAME,
      instructorAccountSchema,
      INSTRUCTOR_ACCOUNTS_COLLECTION,
    )
    );
  }

  public static fromConfig(
    config: MongoInstructorAccountConnectionConfig,
    logger: LoggerPort = new SilentLogger(),
  ): MongoInstructorAccountRepository {
    return new MongoInstructorAccountRepository({
      getCollection: async () => {
        if (!config.mongoUri) {
          throw new Error(
            "MONGODB_URI environment variable is required for instructor accounts.",
          );
        }
        const connection = await MongoConnectionManager.getConnection(
          config.mongoUri,
          config.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
          logger,
        );
        const model = MongoInstructorAccountRepository.getModel(connection);
        // Builds the unique email index (once per model) before any write.
        await model.init();
        return {
          findOne: async filter =>
            model.findOne(filter).lean<InstructorAccountDocument | null>().exec(),
          create: async (doc) => {
            await model.create(doc);
          },
          updateSignInCounters: async (accountId, counters) => {
            await model.updateOne({ _id: accountId }, { $set: counters }).exec();
          },
          findOneAndUpdatePipeline: async (filter, update) =>
            model
              .findOneAndUpdate(filter, [
                ...update,
              ], { returnDocument: "after", updatePipeline: true })
              .lean<InstructorAccountDocument | null>()
              .exec(),
        };
      },
    });
  }

  public async create(account: InstructorAccount): Promise<void> {
    const collection = await this.#getCollection();
    const props = account.toProps();
    try {
      await collection.create({
        _id: props.accountId,
        email: props.email,
        passwordHash: props.passwordHash,
        failedSignInCount: props.failedSignInCount,
        lockedUntil: props.lockedUntil,
        createdAt: props.createdAt,
      });
    }
    catch (error) {
      if (MongoInstructorAccountRepository.#isDuplicateEmail(error)) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  public async findById(accountId: string): Promise<InstructorAccount | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ _id: accountId });
    return doc
      ? MongoInstructorAccountRepository.#toDomain(doc)
      : null;
  }

  public async findByEmail(email: string): Promise<InstructorAccount | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ email });
    return doc
      ? MongoInstructorAccountRepository.#toDomain(doc)
      : null;
  }

  public async saveSignInCounters(account: InstructorAccount): Promise<void> {
    const collection = await this.#getCollection();
    await collection.updateSignInCounters(account.accountId, {
      failedSignInCount: account.failedSignInCount,
      lockedUntil: account.lockedUntil,
    });
  }

  /**
   * One atomic findOneAndUpdate. The filter skips an account locked at `now`
   * (nothing is counted while locked). The pipeline adds one to the count
   * and, when that reaches the limit, sets the 15-minute lock and restarts
   * the count, the same rule as InstructorAccount.recordFailedSignIn.
   */
  public async recordFailedSignIn(accountId: string, now: Date): Promise<InstructorAccount | null> {
    const collection = await this.#getCollection();
    const nextCount = {
      $add: [
        {
          $ifNull: ["$failedSignInCount", 0],
        },
        1,
      ],
    };
    const reachesLimit = {
      $gte: [nextCount, InstructorAccount.MAX_FAILED_SIGN_INS],
    };
    const updated = await collection.findOneAndUpdatePipeline(
      {
        _id: accountId,
        $or: [
          { lockedUntil: null },
          {
            lockedUntil: { $lte: now },
          },
        ],
      },
      [
        {
          $set: {
            failedSignInCount: {
              $cond: [reachesLimit, 0, nextCount],
            },
            lockedUntil: {
              $cond: [
                reachesLimit,
                new Date(now.getTime() + InstructorAccount.LOCK_DURATION_MS),
                null,
              ],
            },
          },
        },
      ],
    );
    if (updated) {
      return MongoInstructorAccountRepository.#toDomain(updated);
    }
    // Locked at `now` (nothing counted), or no such account.
    return this.findById(accountId);
  }

  static #isDuplicateEmail(error: unknown): boolean {
    const mongoError = error as { code?: unknown; keyPattern?: Record<string, unknown> } | null;
    return mongoError?.code === DUPLICATE_KEY_ERROR_CODE
      && mongoError.keyPattern?.email !== undefined;
  }

  static #toDomain(doc: InstructorAccountDocument): InstructorAccount {
    return InstructorAccount.rehydrate({
      accountId: doc._id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      failedSignInCount: doc.failedSignInCount ?? 0,
      lockedUntil: doc.lockedUntil ?? null,
      createdAt: doc.createdAt,
    });
  }
}
