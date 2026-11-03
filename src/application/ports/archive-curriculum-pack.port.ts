import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";

export interface ArchiveCurriculumPackInput {
  readonly packId: string;
}

export interface ArchiveCurriculumPackResult {
  readonly packId: string;
  readonly isArchived: boolean;
  readonly archivedAt: Date;
}

export interface ArchiveCurriculumPackDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
}

export interface ArchiveCurriculumPackUseCasePort {
  execute: (input: ArchiveCurriculumPackInput) => Promise<ArchiveCurriculumPackResult>;
}
