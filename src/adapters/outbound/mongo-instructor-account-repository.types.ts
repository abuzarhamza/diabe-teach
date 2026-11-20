export interface InstructorAccountDocument {
  _id: string;
  email: string;
  passwordHash: string;
  failedSignInCount?: number;
  lockedUntil?: Date | null;
  createdAt: Date;
}

export interface InstructorAccountCollectionLike {
  findOne: (
    filter: Partial<Pick<InstructorAccountDocument, "_id" | "email">>,
  ) => Promise<InstructorAccountDocument | null>;
  /** Throws a MongoDB duplicate-key error (code 11000) for a taken email. */
  create: (doc: InstructorAccountDocument) => Promise<void>;
  updateSignInCounters: (
    accountId: string,
    counters: Pick<InstructorAccountDocument, "failedSignInCount" | "lockedUntil">,
  ) => Promise<void>;
  /**
   * Applies `update` (an aggregation pipeline) to the one account matching
   * `filter`, atomically, and returns it as stored afterwards (null when
   * nothing matched).
   */
  findOneAndUpdatePipeline: (
    filter: Record<string, unknown>,
    update: ReadonlyArray<Record<string, unknown>>,
  ) => Promise<InstructorAccountDocument | null>;
}

export interface MongoInstructorAccountRepositoryOptions {
  getCollection: () => Promise<InstructorAccountCollectionLike>;
}

export interface MongoInstructorAccountConnectionConfig {
  mongoUri?: string;
  mongoDbName?: string;
}
