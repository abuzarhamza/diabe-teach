import type { CurriculumPackProps } from "../../domain/curriculum-pack/curriculum-pack.types.js";

export interface CurriculumPackDocument
  extends Omit<CurriculumPackProps, "id"> {
  readonly _id: string;
}

export interface CurriculumPackCollectionLike {
  findOne: (
    filter: { readonly _id: string },
  ) => Promise<CurriculumPackDocument | null>;
  find: (
    filter?: { readonly isArchived?: boolean },
  ) => Promise<readonly CurriculumPackDocument[]>;
  create: (doc: CurriculumPackDocument) => Promise<void>;
  updateOne: (
    filter: { readonly _id: string },
    update: Partial<CurriculumPackDocument>,
  ) => Promise<void>;
  exists: (
    filter: { readonly _id: string; readonly version: string },
  ) => Promise<boolean>;
}

export interface MongoCurriculumPackRepositoryOptions {
  readonly getCollection: () => Promise<CurriculumPackCollectionLike>;
}

export interface MongoCurriculumPackConnectionConfig {
  readonly mongoUri?: string;
  readonly mongoDbName?: string;
}
