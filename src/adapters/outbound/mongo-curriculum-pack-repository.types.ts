import { CurriculumPackProps } from "../../domain/curriculum-pack/curriculum-pack.types.js";

export interface CurriculumPackDocument
  extends Omit<CurriculumPackProps, "id"> {
  readonly _id: string;
}

export interface CurriculumPackCollectionLike {
  findOne(
    filter: { readonly _id: string },
  ): Promise<CurriculumPackDocument | null>;
}

export interface MongoCurriculumPackRepositoryOptions {
  readonly getCollection: () => Promise<CurriculumPackCollectionLike>;
}

export interface MongoCurriculumPackConnectionConfig {
  readonly mongoUri?: string;
  readonly mongoDbName?: string;
}
