import type { CurriculumPackRepositoryPort } from "../../src/application/ports/curriculum-pack-repository.port.js";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { MongoCurriculumPackRepository } from "../../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { CurriculumPack } from "../../src/domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { PackId } from "../../src/domain/curriculum-pack/pack-id.js";
import { startMongoTestServer, stopMongoTestServer } from "../integration/support/mongo-test-server.js";

/** A non-system pack with Diabe-teach's content, at the given id and version. */
function packVersion(id: string, version: string, title = `${id} ${version}`): CurriculumPack {
  return CurriculumPack.create({
    id,
    title,
    version,
    description: DIABE_TEACH_PACK.description,
    boardConfig: DIABE_TEACH_PACK.boardConfig,
    domains: DIABE_TEACH_PACK.domains,
    cards: DIABE_TEACH_PACK.cards,
    adjudicationRubric: DIABE_TEACH_PACK.adjudicationRubric,
    assessmentInstrument: DIABE_TEACH_PACK.assessmentInstrument,
    perceptionSurvey: DIABE_TEACH_PACK.perceptionSurvey,
    isSystemPack: false,
    isArchived: false,
    createdBy: "author-session",
    authorName: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    archivedAt: null,
  });
}

function defineCurriculumPackRepositoryContract(
  name: string,
  setup: () => Promise<CurriculumPackRepositoryPort>,
  teardown: () => Promise<void> = async () => {},
): void {
  describe(`${name} (curriculum pack repository contract)`, () => {
    let repo: CurriculumPackRepositoryPort;

    beforeAll(async () => {
      repo = await setup();
    }, 60_000);

    afterAll(async () => {
      await teardown();
    });

    it("keeps every registered version and finds each one by id and version", async () => {
      await repo.create(packVersion("versioned-pack", "1.0.0", "First"));
      await repo.create(packVersion("versioned-pack", "1.1.0", "Second"));

      const v1 = await repo.findByIdAndVersion(PackId.create("versioned-pack"), "1.0.0");
      const v11 = await repo.findByIdAndVersion(PackId.create("versioned-pack"), "1.1.0");

      expect(v1?.version).toBe("1.0.0");
      expect(v1?.title).toBe("First");
      expect(v1?.id.value).toBe("versioned-pack");
      expect(v11?.version).toBe("1.1.0");
      expect(v11?.title).toBe("Second");
    });

    it("returns nothing for an unknown version or an unknown pack", async () => {
      await repo.create(packVersion("lonely-pack", "1.0.0"));

      expect(await repo.findByIdAndVersion(PackId.create("lonely-pack"), "9.9.9")).toBeNull();
      expect(await repo.findByIdAndVersion(PackId.create("missing-pack"), "1.0.0")).toBeNull();
    });

    it("finds the highest version by id alone, whatever order the versions were registered in", async () => {
      await repo.create(packVersion("latest-pack", "1.2.0"));
      await repo.create(packVersion("latest-pack", "1.10.0"));
      await repo.create(packVersion("latest-pack", "1.9.0"));

      expect((await repo.findById(PackId.create("latest-pack")))?.version).toBe("1.10.0");
    });

    it("lists one entry per pack, at its latest version", async () => {
      await repo.create(packVersion("listed-pack", "1.0.0"));
      await repo.create(packVersion("listed-pack", "2.0.0"));

      const listed = (await repo.findAll()).filter(pack => pack.id.value === "listed-pack");

      expect(listed.map(pack => pack.version)).toEqual(["2.0.0"]);
    });

    it("reports existence per id and version", async () => {
      await repo.create(packVersion("existing-pack", "1.0.0"));

      expect(await repo.existsByIdAndVersion("existing-pack", "1.0.0")).toBe(true);
      expect(await repo.existsByIdAndVersion("existing-pack", "2.0.0")).toBe(false);
    });

    it("updates only the version it is given", async () => {
      await repo.create(packVersion("archived-pack", "1.0.0"));
      await repo.create(packVersion("archived-pack", "2.0.0"));

      const latest = await repo.findById(PackId.create("archived-pack"));
      await repo.update(latest!.archive(new Date("2026-11-19T10:00:00.000Z")));

      expect((await repo.findByIdAndVersion(PackId.create("archived-pack"), "2.0.0"))?.isArchived).toBe(true);
      expect((await repo.findByIdAndVersion(PackId.create("archived-pack"), "1.0.0"))?.isArchived).toBe(false);
      expect((await repo.findAllActive()).some(pack => pack.id.value === "archived-pack")).toBe(false);
    });
  });
}

defineCurriculumPackRepositoryContract("inMemoryCurriculumPackRepository", async () =>
  new InMemoryCurriculumPackRepository([]));

const MONGO_DB_NAME = "curriculum-pack-contract";
let mongoUri = "";

defineCurriculumPackRepositoryContract(
  "mongoCurriculumPackRepository",
  async () => {
    mongoUri = await startMongoTestServer();
    return MongoCurriculumPackRepository.fromConfig({ mongoUri, mongoDbName: MONGO_DB_NAME });
  },
  // The server is stopped once, after the legacy-document suite below.
);

describe("mongoCurriculumPackRepository with documents stored before version lookup", () => {
  let repo: MongoCurriculumPackRepository;

  beforeAll(async () => {
    mongoUri = await startMongoTestServer();
    repo = MongoCurriculumPackRepository.fromConfig({ mongoUri, mongoDbName: "curriculum-pack-legacy" });
  }, 60_000);

  afterAll(stopMongoTestServer);

  it("reads a legacy document (pack id as _id) alongside newer versions of the same pack", async () => {
    const connection = await mongoose.createConnection(mongoUri, { dbName: "curriculum-pack-legacy" }).asPromise();
    try {
      const legacy = packVersion("legacy-pack", "1.0.0", "Legacy");
      await connection.collection(MongoCurriculumPackRepository.collectionName).insertOne({
        _id: "legacy-pack" as unknown as never,
        title: legacy.title,
        version: legacy.version,
        description: legacy.description,
        boardConfig: legacy.boardConfig,
        domains: legacy.domains,
        cards: legacy.cards,
        adjudicationRubric: legacy.adjudicationRubric,
        assessmentInstrument: legacy.assessmentInstrument,
        perceptionSurvey: legacy.perceptionSurvey,
        isSystemPack: false,
        isArchived: false,
        createdBy: "author-session",
        authorName: null,
        createdAt: legacy.createdAt,
        archivedAt: null,
      });
    }
    finally {
      await connection.close();
    }

    expect((await repo.findById(PackId.create("legacy-pack")))?.title).toBe("Legacy");
    expect(await repo.existsByIdAndVersion("legacy-pack", "1.0.0")).toBe(true);

    await repo.create(packVersion("legacy-pack", "2.0.0", "Newer"));

    expect((await repo.findById(PackId.create("legacy-pack")))?.title).toBe("Newer");
    const v1 = await repo.findByIdAndVersion(PackId.create("legacy-pack"), "1.0.0");
    expect(v1?.title).toBe("Legacy");
    expect(v1?.id.value).toBe("legacy-pack");
    expect((await repo.findAll()).filter(pack => pack.id.value === "legacy-pack")).toHaveLength(1);
  });
});
