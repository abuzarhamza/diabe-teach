import type { CurriculumPackRepositoryPort } from "../../application/ports/curriculum-pack-repository.port.js";
import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { DIABE_TEACH_PACK } from "../../domain/curriculum-pack/diabe-teach-pack.js";
import { PackVersionOrder } from "./pack-version-order.js";

export class InMemoryCurriculumPackRepository
implements CurriculumPackRepositoryPort {
  /** Every stored Pack Version, keyed by pack id and then by version. */
  readonly #versionsById: Map<string, Map<string, CurriculumPack>>;

  public constructor(
    initialPacks: readonly CurriculumPack[] = [DIABE_TEACH_PACK],
  ) {
    this.#versionsById = new Map();
    for (const pack of initialPacks) {
      this.#store(pack);
    }
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    return this.#latest(packId.value);
  }

  public async findByIdAndVersion(
    packId: PackId,
    version: string,
  ): Promise<CurriculumPack | null> {
    return this.#versionsById.get(packId.value)?.get(version) ?? null;
  }

  public async findAll(): Promise<readonly CurriculumPack[]> {
    return [...this.#versionsById.keys()]
      .map(id => this.#latest(id))
      .filter((pack): pack is CurriculumPack => pack !== null);
  }

  public async findAllActive(): Promise<readonly CurriculumPack[]> {
    return (await this.findAll()).filter(pack => !pack.isArchived);
  }

  public async create(pack: CurriculumPack): Promise<void> {
    this.#store(pack);
  }

  public async update(pack: CurriculumPack): Promise<void> {
    this.#store(pack);
  }

  public async existsByIdAndVersion(
    packId: string,
    version: string,
  ): Promise<boolean> {
    return this.#versionsById.get(packId)?.has(version) ?? false;
  }

  #store(pack: CurriculumPack): void {
    const versions = this.#versionsById.get(pack.id.value) ?? new Map<string, CurriculumPack>();
    versions.set(pack.version, pack);
    this.#versionsById.set(pack.id.value, versions);
  }

  #latest(packId: string): CurriculumPack | null {
    const versions = this.#versionsById.get(packId);
    return versions
      ? PackVersionOrder.latest([...versions.values()])
      : null;
  }
}
