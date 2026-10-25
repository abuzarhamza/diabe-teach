import { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../domain/curriculum-pack/diabe-teach-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { getMongoDatabase } from "./mongo-client-singleton.js";
import {
  CurriculumPackCollectionLike,
  CurriculumPackDocument,
  MongoCurriculumPackConnectionConfig,
  MongoCurriculumPackRepositoryOptions,
} from "./mongo-curriculum-pack-repository.types.js";

export const DEFAULT_MONGODB_DB_NAME = "diabe_teach";
export const CURRICULUM_PACKS_COLLECTION = "curriculum_packs";

export class MongoCurriculumPackRepository
  implements CurriculumPackRepositoryPort
{
  readonly #builtInPacks = new Map<string, CurriculumPack>();
  readonly #getCollection: () => Promise<CurriculumPackCollectionLike>;

  public constructor(options: MongoCurriculumPackRepositoryOptions) {
    const seeds = options.builtInPacks ?? [DIABE_TEACH_PACK];
    for (const pack of seeds) {
      this.#builtInPacks.set(pack.id.value, pack);
    }
    this.#getCollection = options.getCollection;
  }

  public static fromConfig(
    getConfig: () => MongoCurriculumPackConnectionConfig,
  ): MongoCurriculumPackRepository {
    const initial = getConfig();
    return new MongoCurriculumPackRepository({
      builtInPacks: initial.builtInPacks,
      getCollection: async () => {
        const current = getConfig();
        if (!current.mongoUri) {
          throw new Error(
            "MONGODB_URI environment variable is required to query custom Curriculum Packs.",
          );
        }
        const db = await getMongoDatabase(
          current.mongoUri,
          current.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
        );
        return db.collection<CurriculumPackDocument>(
          CURRICULUM_PACKS_COLLECTION,
        );
      },
    });
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    const builtIn = this.#builtInPacks.get(packId.value);
    if (builtIn) {
      return builtIn;
    }

    const collection = await this.#getCollection();
    const doc = await collection.findOne({ _id: packId.value });
    if (!doc) {
      return null;
    }

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
