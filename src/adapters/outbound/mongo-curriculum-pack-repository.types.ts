import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
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
  readonly builtInPacks?: readonly CurriculumPack[];
}

export interface MongoCurriculumPackConnectionConfig {
  readonly mongoUri?: string;
  readonly mongoDbName?: string;
  readonly builtInPacks?: readonly CurriculumPack[];
}
