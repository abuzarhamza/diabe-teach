import type { Connection, Model } from "mongoose";
import type { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import type { PackId } from "../../domain/curriculum-pack/pack-id.js";
import type {
  CurriculumPackCollectionLike,
  CurriculumPackDocument,
  CurriculumPackFilter,
  MongoCurriculumPackConnectionConfig,
  MongoCurriculumPackRepositoryOptions,
} from "./mongo-curriculum-pack-repository.types.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import {
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
  curriculumPackSchema,
  DEFAULT_MONGODB_DB_NAME,
} from "./curriculum-pack.schema.js";
import { MongoConnectionManager } from "./mongo-client-singleton.js";
import { PackVersionOrder } from "./pack-version-order.js";

export {
  CURRICULUM_PACK_MODEL_NAME,
  CURRICULUM_PACKS_COLLECTION,
  curriculumPackSchema,
  DEFAULT_MONGODB_DB_NAME,
};

export class MongoCurriculumPackRepository
implements CurriculumPackRepositoryPort {
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
      | undefined)
    ?? connection.model<CurriculumPackDocument>(
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
          findOne: async filter =>
            model.findOne(filter).lean<CurriculumPackDocument | null>().exec(),
          find: async (filter = {}) =>
            model.find(filter).lean<CurriculumPackDocument[]>().exec(),
          create: async (doc) => {
            await model.create(doc);
          },
          updateOne: async (filter, update) => {
            await model.updateOne(filter, { $set: update }).exec();
          },
          exists: async filter =>
            (await model.exists(filter)) !== null,
        };
      },
    });
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    const collection = await this.#getCollection();
    const docs = await collection.find(
      MongoCurriculumPackRepository.#versionsOf(packId.value),
    );
    const latest = PackVersionOrder.latest(docs);
    return latest
      ? MongoCurriculumPackRepository.#toDomain(latest)
      : null;
  }

  public async findByIdAndVersion(
    packId: PackId,
    version: string,
  ): Promise<CurriculumPack | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne(
      MongoCurriculumPackRepository.#exactVersion(packId.value, version),
    );
    return doc
      ? MongoCurriculumPackRepository.#toDomain(doc)
      : null;
  }

  public async findAll(): Promise<readonly CurriculumPack[]> {
    const collection = await this.#getCollection();
    const docs = await collection.find();
    return PackVersionOrder.latestOfEach(
      docs.map(doc => MongoCurriculumPackRepository.#toDomain(doc)),
    );
  }

  public async findAllActive(): Promise<readonly CurriculumPack[]> {
    return (await this.findAll()).filter(pack => !pack.isArchived);
  }

  public async create(pack: CurriculumPack): Promise<void> {
    const collection = await this.#getCollection();
    await collection.create({
      ...MongoCurriculumPackRepository.#toDocument(pack),
      _id: `${pack.id.value}@${pack.version}`,
    });
  }

  public async update(pack: CurriculumPack): Promise<void> {
    const collection = await this.#getCollection();
    const { _id, ...updateFields } = MongoCurriculumPackRepository.#toDocument(pack);
    await collection.updateOne(
      MongoCurriculumPackRepository.#exactVersion(_id, pack.version),
      updateFields,
    );
  }

  public async existsByIdAndVersion(
    packId: string,
    version: string,
  ): Promise<boolean> {
    const collection = await this.#getCollection();
    return collection.exists(
      MongoCurriculumPackRepository.#exactVersion(packId, version),
    );
  }

  /** Every stored version of a pack, in either document layout. */
  static #versionsOf(packId: string): CurriculumPackFilter {
    return {
      $or: [
        { packId },
        { _id: packId },
      ],
    };
  }

  static #exactVersion(packId: string, version: string): CurriculumPackFilter {
    return {
      $or: [
        { packId, version },
        { _id: packId, version },
      ],
    };
  }

  static #toDomain(doc: CurriculumPackDocument): CurriculumPack {
    return CurriculumPack.create({
      id: doc.packId ?? doc._id,
      title: doc.title,
      version: doc.version,
      description: doc.description,
      boardConfig: doc.boardConfig,
      domains: doc.domains,
      cards: doc.cards,
      adjudicationRubric: doc.adjudicationRubric,
      assessmentInstrument: doc.assessmentInstrument,
      perceptionSurvey: doc.perceptionSurvey,
      isSystemPack: doc.isSystemPack,
      isArchived: doc.isArchived,
      createdBy: doc.createdBy,
      authorName: doc.authorName,
      createdAt: doc.createdAt,
      archivedAt: doc.archivedAt,
    });
  }

  static #toDocument(pack: CurriculumPack): CurriculumPackDocument {
    return {
      _id: pack.id.value,
      packId: pack.id.value,
      title: pack.title,
      version: pack.version,
      description: pack.description,
      boardConfig: pack.boardConfig,
      domains: pack.domains,
      cards: pack.cards,
      adjudicationRubric: pack.adjudicationRubric,
      assessmentInstrument: pack.assessmentInstrument,
      perceptionSurvey: pack.perceptionSurvey,
      isSystemPack: pack.isSystemPack,
      isArchived: pack.isArchived,
      createdBy: pack.createdBy,
      authorName: pack.authorName,
      createdAt: pack.createdAt,
      archivedAt: pack.archivedAt,
    };
  }
}
