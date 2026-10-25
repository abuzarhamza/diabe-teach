import { Connection, Model } from "mongoose";
import { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
  curriculumPackSchema,
  DEFAULT_MONGODB_DB_NAME,
} from "./curriculum-pack.schema.js";
import { MongoConnectionManager } from "./mongo-client-singleton.js";
import {
  CurriculumPackCollectionLike,
  CurriculumPackDocument,
  MongoCurriculumPackConnectionConfig,
  MongoCurriculumPackRepositoryOptions,
} from "./mongo-curriculum-pack-repository.types.js";

export {
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
  curriculumPackSchema,
  DEFAULT_MONGODB_DB_NAME,
};

export class MongoCurriculumPackRepository
  implements CurriculumPackRepositoryPort
{
  public static readonly modelName = CURRICULUM_PACK_MODEL_NAME;
  public static readonly collectionName = CURRICULUM_PACKS_COLLECTION;

  readonly #getCollection: () => Promise<CurriculumPackCollectionLike>;

  public constructor(options: MongoCurriculumPackRepositoryOptions) {
    this.#getCollection = options.getCollection;
  }

  public static getModel(
    connection: Connection,
  ): Model<CurriculumPackDocument> {
    return (
      (connection.models[CURRICULUM_PACK_MODEL_NAME] as
        | Model<CurriculumPackDocument>
        | undefined) ??
      connection.model<CurriculumPackDocument>(
        CURRICULUM_PACK_MODEL_NAME,
        curriculumPackSchema,
        CURRICULUM_PACKS_COLLECTION,
      )
    );
  }

  public static fromConfig(
    config: MongoCurriculumPackConnectionConfig,
  ): MongoCurriculumPackRepository {
    return new MongoCurriculumPackRepository({
      getCollection: async () => {
        if (!config.mongoUri) {
          throw new Error(
            "MONGODB_URI environment variable is required to query Curriculum Packs.",
          );
        }
        const connection = await MongoConnectionManager.getConnection(
          config.mongoUri,
          config.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
        );
        const model = MongoCurriculumPackRepository.getModel(connection);
        return {
          findOne: async (filter) =>
            model.findOne(filter).lean<CurriculumPackDocument | null>().exec(),
        };
      },
    });
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ _id: packId.value });
    return doc ? MongoCurriculumPackRepository.#toDomain(doc) : null;
  }

  static #toDomain(doc: CurriculumPackDocument): CurriculumPack {
    return CurriculumPack.create({
      id: doc._id,
      title: doc.title,
      version: doc.version,
      description: doc.description,
      boardConfig: doc.boardConfig,
      domains: doc.domains,
      cards: doc.cards,
      adjudicationRubric: doc.adjudicationRubric,
      assessmentInstrument: doc.assessmentInstrument,
      perceptionSurvey: doc.perceptionSurvey,
    });
  }
}
