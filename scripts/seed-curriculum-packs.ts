import { DEFAULT_MONGODB_DB_NAME } from "../src/adapters/outbound/curriculum-pack.schema.js";
import { MongoConnectionManager } from "../src/adapters/outbound/mongo-client-singleton.js";
import { MongoCurriculumPackRepository } from "../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { CurriculumPackDocument } from "../src/adapters/outbound/mongo-curriculum-pack-repository.types.js";
import { CurriculumPack } from "../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../src/domain/curriculum-pack/diabe-teach-pack.js";

export interface SeedingResult {
  readonly seededCount: number;
  readonly packIds: readonly string[];
}

export interface SeederOptions {
  readonly mongoUri?: string;
  readonly dbName?: string;
  readonly packs?: readonly CurriculumPack[];
}

export class CurriculumPackSeeder {
  public static toDocument(pack: CurriculumPack): CurriculumPackDocument {
    return {
      _id: pack.id.value,
      title: pack.title,
      version: pack.version,
      description: pack.description,
      boardConfig: pack.boardConfig,
      domains: [...pack.domains],
      cards: [...pack.cards],
      adjudicationRubric: pack.adjudicationRubric,
      assessmentInstrument: pack.assessmentInstrument,
      perceptionSurvey: pack.perceptionSurvey,
    };
  }

  public static async seed(options?: SeederOptions): Promise<SeedingResult> {
    const mongoUri = options?.mongoUri ?? process.env.MONGODB_URI?.trim();
    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI environment variable is required to seed Curriculum Packs into MongoDB.",
      );
    }
    const dbName =
      options?.dbName ??
      process.env.MONGODB_DB_NAME?.trim() ??
      DEFAULT_MONGODB_DB_NAME;
    const packs = options?.packs ?? [DIABE_TEACH_PACK];

    const connection = await MongoConnectionManager.getConnection(
      mongoUri,
      dbName,
    );
    const model = MongoCurriculumPackRepository.getModel(connection);

    const seededIds: string[] = [];
    for (const pack of packs) {
      const doc = CurriculumPackSeeder.toDocument(pack);
      await model.replaceOne({ _id: doc._id }, doc, { upsert: true });
      seededIds.push(doc._id);
    }

    return {
      seededCount: seededIds.length,
      packIds: Object.freeze(seededIds),
    };
  }
}

if (
  process.argv[1]?.endsWith("seed-curriculum-packs.ts") ||
  process.argv[1]?.endsWith("seed-curriculum-packs.js")
) {
  CurriculumPackSeeder.seed()
    .then((result) => {
      console.log(
        `Successfully seeded ${result.seededCount} Curriculum Pack(s) into MongoDB: [${result.packIds.join(", ")}]`,
      );
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("Failed to seed Curriculum Packs:", error);
      process.exit(1);
    });
}
