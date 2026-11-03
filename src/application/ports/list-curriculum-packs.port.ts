import type { CurriculumPackSummaryDto } from "../dtos/curriculum-pack.dto.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";

export interface ListCurriculumPacksDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
}

export interface ListCurriculumPacksResult {
  readonly packs: readonly CurriculumPackSummaryDto[];
}

export interface ListCurriculumPacksUseCasePort {
  execute: () => Promise<ListCurriculumPacksResult>;
}
