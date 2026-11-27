import type { ClockPort } from "./clock.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { LoggerPort } from "./logger.port.js";

export interface ArchiveCurriculumPackInput {
  readonly packId: string;
  /** The Instructor Account archiving the pack. */
  readonly accountId: string;
}

export interface ArchiveCurriculumPackResult {
  readonly packId: string;
  readonly isArchived: boolean;
  readonly archivedAt: Date;
  readonly archivedBy: string;
}

export interface ArchiveCurriculumPackDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  /** Defaults to the wall clock. */
  readonly clock?: ClockPort;
}

export interface ArchiveCurriculumPackUseCasePort {
  execute: (input: ArchiveCurriculumPackInput, logger?: LoggerPort) => Promise<ArchiveCurriculumPackResult>;
}
