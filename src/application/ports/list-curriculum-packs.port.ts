import type { CurriculumPackListItemDto } from "../dtos/curriculum-pack.dto.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";
import type { InstructorAccountRepositoryPort } from "./instructor-account-repository.port.js";

export interface ListCurriculumPacksDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  /**
   * Looks up the account behind each latest Pack Version's `createdBy` to
   * work out its author handle.
   */
  readonly accountRepo: InstructorAccountRepositoryPort;
}

export interface ListCurriculumPacksInput {
  /** Also list packs whose latest version is archived. Defaults to false. */
  readonly includeArchived?: boolean;
}

export interface ListCurriculumPacksResult {
  readonly packs: readonly CurriculumPackListItemDto[];
}

export interface ListCurriculumPacksUseCasePort {
  execute: (input?: ListCurriculumPacksInput) => Promise<ListCurriculumPacksResult>;
}
