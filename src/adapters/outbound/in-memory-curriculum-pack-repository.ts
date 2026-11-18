import type { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { DIABE_TEACH_PACK } from "../../domain/curriculum-pack/diabe-teach-pack.js";

export class InMemoryCurriculumPackRepository
implements CurriculumPackRepositoryPort {
  readonly #packsById: Map<string, CurriculumPack>;

  public constructor(
    initialPacks: readonly CurriculumPack[] = [DIABE_TEACH_PACK],
  ) {
    this.#packsById = new Map(
      initialPacks.map(pack => [pack.id.value, pack]),
    );
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    return this.#packsById.get(packId.value) ?? null;
  }

  public async findAll(): Promise<readonly CurriculumPack[]> {
    return [...this.#packsById.values()];
  }

  public async findAllActive(): Promise<readonly CurriculumPack[]> {
    return [...this.#packsById.values()].filter(pack => !pack.isArchived);
  }

  public async create(pack: CurriculumPack): Promise<void> {
    this.#packsById.set(pack.id.value, pack);
  }

  public async update(pack: CurriculumPack): Promise<void> {
    this.#packsById.set(pack.id.value, pack);
  }

  public async existsByIdAndVersion(
    packId: string,
    version: string,
  ): Promise<boolean> {
    const pack = this.#packsById.get(packId);
    return pack !== undefined && pack.version === version;
  }
}
