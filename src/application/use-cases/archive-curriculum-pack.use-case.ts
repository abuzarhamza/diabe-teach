import type {
  ArchiveCurriculumPackDependencies,
  ArchiveCurriculumPackInput,
  ArchiveCurriculumPackResult,
  ArchiveCurriculumPackUseCasePort,
} from "../ports/archive-curriculum-pack.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  PackAlreadyArchivedError,
  PackIsSystemPackError,
  PackNotFoundError,
} from "../../domain/errors/domain-errors.js";

export class ArchiveCurriculumPackUseCase
implements ArchiveCurriculumPackUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: ArchiveCurriculumPackDependencies) {
    this.#packRepo = deps.packRepo;
  }

  public async execute(
    input: ArchiveCurriculumPackInput,
  ): Promise<ArchiveCurriculumPackResult> {
    const packId = PackId.create(input.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(input.packId);
    }

    if (pack.isSystemPack) {
      throw new PackIsSystemPackError(input.packId);
    }

    if (pack.isArchived) {
      throw new PackAlreadyArchivedError(input.packId);
    }

    const archivedAt = new Date();
    const archivedPack = pack.archive(archivedAt);

    await this.#packRepo.update(archivedPack);

    return {
      packId: archivedPack.id.value,
      isArchived: archivedPack.isArchived,
      archivedAt,
    };
  }
}
