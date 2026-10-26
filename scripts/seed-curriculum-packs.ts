import type { CurriculumPackDocument } from "../src/adapters/outbound/mongo-curriculum-pack-repository.types.js";
import type { CurriculumPack } from "../src/domain/curriculum-pack/curriculum-pack.js";
import { DEFAULT_MONGODB_DB_NAME } from "../src/adapters/outbound/curriculum-pack.schema.js";
import { MongoConnectionManager } from "../src/adapters/outbound/mongo-client-singleton.js";
import { MongoCurriculumPackRepository } from "../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { AppRuntime } from "../src/app-runtime.js";
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
  public static resolveOptions(options?: SeederOptions): {
    readonly mongoUri?: string;
    readonly dbName: string;
    readonly packs: readonly CurriculumPack[];
  } {
    const rawEnvUri = options?.mongoUri ?? process.env.MONGODB_URI?.trim();
    const rawEnvDb = options?.dbName ?? process.env.MONGODB_DB_NAME?.trim();
    const runtimeConfig = AppRuntime.loadEnvConfig();

    return {
      mongoUri: rawEnvUri || runtimeConfig.mongoUri,
      dbName: rawEnvDb || runtimeConfig.mongoDbName || DEFAULT_MONGODB_DB_NAME,
      packs: options?.packs ?? [DIABE_TEACH_PACK],
    };
  }

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
    const rawUri = options?.mongoUri ?? process.env.MONGODB_URI?.trim();
    if (!rawUri) {
      throw new Error(
        "MONGODB_URI environment variable is required to seed Curriculum Packs into MongoDB.",
      );
    }
    const { mongoUri, dbName, packs }
      = CurriculumPackSeeder.resolveOptions(options);

    const connection = await MongoConnectionManager.getConnection(
      mongoUri!,
      dbName,
    );
    const model = MongoCurriculumPackRepository.getModel(connection);

    const seededIds = await Promise.all(
      packs.map(async (pack) => {
        const doc = CurriculumPackSeeder.toDocument(pack);
        await model.replaceOne({ _id: doc._id }, doc, { upsert: true });
        return doc._id;
      }),
    );

    return {
      seededCount: seededIds.length,
      packIds: Object.freeze(seededIds),
    };
  }
}

const isCli
  = process.argv[1]?.endsWith("seed-curriculum-packs.ts")
    || process.argv[1]?.endsWith("seed-curriculum-packs.js");

if (isCli) {
  CurriculumPackSeeder.seed()
    .then((result) => {
      console.log(
        `Successfully seeded ${result.seededCount} Curriculum Pack(s) into MongoDB: [${result.packIds.join(", ")}]`,
      );
    })
    .catch((error: unknown) => {
      console.error("Failed to seed Curriculum Packs:", error);
      process.exit(1);
    });
}
