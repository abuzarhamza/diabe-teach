import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";

export interface UnarchiveCurriculumPackInput {
  readonly packId: string;
}

export interface UnarchiveCurriculumPackResult {
  readonly packId: string;
  readonly isArchived: boolean;
}

export interface UnarchiveCurriculumPackDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
}

export interface UnarchiveCurriculumPackUseCasePort {
  execute: (input: UnarchiveCurriculumPackInput) => Promise<UnarchiveCurriculumPackResult>;
}
