import { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { DIABE_TEACH_PACK } from "../../domain/curriculum-pack/diabe-teach-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";

export class InMemoryCurriculumPackRepository
  implements CurriculumPackRepositoryPort
{
  readonly #packsById: ReadonlyMap<string, CurriculumPack>;

  public constructor(
    initialPacks: readonly CurriculumPack[] = [DIABE_TEACH_PACK],
  ) {
    this.#packsById = new Map(
      initialPacks.map((pack) => [pack.id.value, pack]),
    );
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    return this.#packsById.get(packId.value) ?? null;
  }
}
