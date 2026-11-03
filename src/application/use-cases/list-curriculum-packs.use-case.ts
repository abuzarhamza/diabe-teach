import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type {
  ListCurriculumPacksDependencies,
  ListCurriculumPacksResult,
  ListCurriculumPacksUseCasePort,
} from "../ports/list-curriculum-packs.port.js";
import { CurriculumPackProjector } from "../dtos/curriculum-pack-projector.js";

export class ListCurriculumPacksUseCase
implements ListCurriculumPacksUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: ListCurriculumPacksDependencies) {
    this.#packRepo = deps.packRepo;
  }

  public async execute(): Promise<ListCurriculumPacksResult> {
    const packs = await this.#packRepo.findAllActive();

    return {
      packs: packs.map(pack => CurriculumPackProjector.toSummaryDto(pack)),
    };
  }
}
