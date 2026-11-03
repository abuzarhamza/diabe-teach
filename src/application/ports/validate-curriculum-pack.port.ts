import type { CurriculumPackProps } from "../../domain/curriculum-pack/curriculum-pack.types.js";

export interface ValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidationWarning {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidateCurriculumPackInput {
  readonly pack: Omit<
    CurriculumPackProps,
    "id" | "isSystemPack" | "isArchived" | "createdBy" | "authorName" | "createdAt" | "archivedAt"
  > & { readonly id: string };
}

export interface ValidateCurriculumPackResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidateCurriculumPackUseCasePort {
  execute: (input: ValidateCurriculumPackInput) => Promise<ValidateCurriculumPackResult>;
}
