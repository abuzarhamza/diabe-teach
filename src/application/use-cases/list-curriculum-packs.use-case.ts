import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { InstructorAccountRepositoryPort } from "../ports/instructor-account-repository.port.js";
import type {
  ListCurriculumPacksDependencies,
  ListCurriculumPacksInput,
  ListCurriculumPacksResult,
  ListCurriculumPacksUseCasePort,
} from "../ports/list-curriculum-packs.port.js";
import { CurriculumPackProjector } from "../dtos/curriculum-pack-projector.js";

/**
 * Lists the latest Pack Version of every pack, with the author handle of
 * whoever released it (ADR-0007). Archived packs are hidden unless asked for.
 */
export class ListCurriculumPacksUseCase
implements ListCurriculumPacksUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #accountRepo: InstructorAccountRepositoryPort;

  public constructor(deps: ListCurriculumPacksDependencies) {
    this.#packRepo = deps.packRepo;
    this.#accountRepo = deps.accountRepo;
  }

  public async execute(
    input: ListCurriculumPacksInput = {},
  ): Promise<ListCurriculumPacksResult> {
    const packs = input.includeArchived === true
      ? await this.#packRepo.findAll()
      : await this.#packRepo.findAllActive();
    const handles = await this.#authorHandles(packs);

    return {
      packs: packs.map(pack => CurriculumPackProjector.toListItemDto(
        pack,
        pack.createdBy === null
          ? null
          : handles.get(pack.createdBy) ?? null,
      )),
    };
  }

  /**
   * The author handle for each distinct `createdBy`, worked out from the
   * account's email now rather than stored. A `createdBy` that is not an
   * account (an older pack's session id) gets no entry.
   */
  async #authorHandles(
    packs: readonly CurriculumPack[],
  ): Promise<ReadonlyMap<string, string>> {
    const accountRepo = this.#accountRepo;
    const creatorIds = [
      ...new Set(
        packs
          .map(pack => pack.createdBy)
          .filter((id): id is string => id !== null),
      ),
    ];
    const accounts = await Promise.all(
      creatorIds.map(async id => accountRepo.findById(id)),
    );
    const handles = new Map<string, string>();
    for (const account of accounts) {
      if (account) {
        handles.set(account.accountId, account.authorHandle);
      }
    }
    return handles;
  }
}
