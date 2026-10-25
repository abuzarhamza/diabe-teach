import { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../domain/curriculum-pack/diabe-teach-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  CurriculumPackCollectionLike,
  MongoCurriculumPackRepositoryOptions,
} from "./mongo-curriculum-pack-repository.types.js";

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
