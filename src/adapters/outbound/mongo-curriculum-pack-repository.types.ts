import type { CurriculumPackProps } from "../../domain/curriculum-pack/curriculum-pack.types.js";

/**
 * One stored Pack Version. Versions registered since version lookup existed
 * use `<packId>@<version>` as `_id` and carry `packId`. Older documents
 * (seeded System Packs and packs registered earlier) use the pack id itself
 * as `_id` and have no `packId` field.
 */
export interface CurriculumPackDocument
  extends Omit<CurriculumPackProps, "id"> {
  readonly _id: string;
  readonly packId?: string;
}

/** A MongoDB filter over stored Pack Versions. */
export type CurriculumPackFilter = Readonly<Record<string, unknown>>;

export interface CurriculumPackCollectionLike {
  findOne: (
    filter: CurriculumPackFilter,
  ) => Promise<CurriculumPackDocument | null>;
  find: (
    filter?: CurriculumPackFilter,
  ) => Promise<readonly CurriculumPackDocument[]>;
  create: (doc: CurriculumPackDocument) => Promise<void>;
  updateOne: (
    filter: CurriculumPackFilter,
    update: Partial<CurriculumPackDocument>,
  ) => Promise<void>;
  exists: (
    filter: CurriculumPackFilter,
  ) => Promise<boolean>;
}

export interface MongoCurriculumPackRepositoryOptions {
  readonly getCollection: () => Promise<CurriculumPackCollectionLike>;
}

export interface MongoCurriculumPackConnectionConfig {
  readonly mongoUri?: string;
  readonly mongoDbName?: string;
}
