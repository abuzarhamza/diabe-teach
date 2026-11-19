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
}

export interface MongoInstructorAccountRepositoryOptions {
  getCollection: () => Promise<InstructorAccountCollectionLike>;
}

export interface MongoInstructorAccountConnectionConfig {
  mongoUri?: string;
  mongoDbName?: string;
}
