import type {
  ArchiveCurriculumPackDependencies,
  ArchiveCurriculumPackInput,
  ArchiveCurriculumPackResult,
  ArchiveCurriculumPackUseCasePort,
} from "../ports/archive-curriculum-pack.port.js";
import type { ClockPort } from "../ports/clock.port.js";
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
  readonly #clock: ClockPort;

  public constructor(deps: ArchiveCurriculumPackDependencies) {
    this.#packRepo = deps.packRepo;
    this.#clock = deps.clock ?? {
      now: () => new Date(),
    };
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

    // Any signed-in teacher may archive any non-system pack (ADR-0007);
    // the record says who did it and when.
    const archivedAt = this.#clock.now();
    const archivedPack = pack.archive(archivedAt, input.accountId);

    await this.#packRepo.update(archivedPack);

    return {
      packId: archivedPack.id.value,
      isArchived: archivedPack.isArchived,
      archivedAt,
      archivedBy: input.accountId,
    };
  }
}
