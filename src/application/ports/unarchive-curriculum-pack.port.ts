import type { ClockPort } from "./clock.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { LoggerPort } from "./logger.port.js";

export interface UnarchiveCurriculumPackInput {
  readonly packId: string;
  /** The Instructor Account unarchiving the pack. */
  readonly accountId: string;
}

export interface UnarchiveCurriculumPackResult {
  readonly packId: string;
  readonly isArchived: boolean;
  readonly unarchivedAt: Date;
  readonly unarchivedBy: string;
}

export interface UnarchiveCurriculumPackDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  /** Defaults to the wall clock. */
  readonly clock?: ClockPort;
}

export interface UnarchiveCurriculumPackUseCasePort {
  execute: (input: UnarchiveCurriculumPackInput, logger?: LoggerPort) => Promise<UnarchiveCurriculumPackResult>;
}
