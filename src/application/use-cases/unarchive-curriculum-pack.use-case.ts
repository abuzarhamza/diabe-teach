import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type {
  UnarchiveCurriculumPackDependencies,
  UnarchiveCurriculumPackInput,
  UnarchiveCurriculumPackResult,
  UnarchiveCurriculumPackUseCasePort,
} from "../ports/unarchive-curriculum-pack.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  PackNotArchivedError,
  PackNotFoundError,
} from "../../domain/errors/domain-errors.js";

export class UnarchiveCurriculumPackUseCase
implements UnarchiveCurriculumPackUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: UnarchiveCurriculumPackDependencies) {
    this.#packRepo = deps.packRepo;
  }

  public async execute(
    input: UnarchiveCurriculumPackInput,
  ): Promise<UnarchiveCurriculumPackResult> {
    const packId = PackId.create(input.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(input.packId);
    }

    if (!pack.isArchived) {
      throw new PackNotArchivedError(input.packId);
    }

    const unarchivedPack = pack.unarchive();

    await this.#packRepo.update(unarchivedPack);

    return {
      packId: unarchivedPack.id.value,
      isArchived: unarchivedPack.isArchived,
    };
  }
}
