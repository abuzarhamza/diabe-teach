import type { Connection, Model } from "mongoose";
import type { InstructorAccountRepositoryPort } from "../../application/ports/instructor-account-repository.port.js";
import type {
  InstructorAccountCollectionLike,
  InstructorAccountDocument,
  MongoInstructorAccountConnectionConfig,
  MongoInstructorAccountRepositoryOptions,
} from "./mongo-instructor-account-repository.types.js";
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
