import type { CurriculumPackProps } from "../../domain/curriculum-pack/curriculum-pack.types.js";
import type { ClockPort } from "./clock.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { LoggerPort } from "./logger.port.js";
import type {
  ValidationError,
  ValidationWarning,
} from "./validate-curriculum-pack.port.js";

export interface RegisterCurriculumPackInput {
  readonly pack: Omit<
    CurriculumPackProps,
    "id" | "isSystemPack" | "isArchived" | "createdBy" | "authorName" | "createdAt" | "archivedAt" | "archivedBy" | "unarchivedAt" | "unarchivedBy"
  > & { readonly id: string; readonly authorName?: string };
  /** The Instructor Account releasing this Pack Version; becomes its `createdBy`. */
  readonly accountId: string;
}

export interface RegisterCurriculumPackSuccessResult {
  readonly success: true;
  readonly packId: string;
  readonly version: string;
  readonly warnings: readonly ValidationWarning[];
}

export interface RegisterCurriculumPackValidationFailedResult {
  readonly success: false;
  readonly code: "PACK_VALIDATION_FAILED";
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface RegisterCurriculumPackAlreadyExistsResult {
  readonly success: false;
  readonly code: "PACK_ALREADY_EXISTS";
  readonly packId: string;
  readonly version: string;
}

export type RegisterCurriculumPackResult
  = | RegisterCurriculumPackSuccessResult
    | RegisterCurriculumPackValidationFailedResult
    | RegisterCurriculumPackAlreadyExistsResult;

export interface RegisterCurriculumPackDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  /** Defaults to the wall clock. */
  readonly clock?: ClockPort;
}

export interface RegisterCurriculumPackUseCasePort {
  execute: (input: RegisterCurriculumPackInput, logger?: LoggerPort) => Promise<RegisterCurriculumPackResult>;
}
