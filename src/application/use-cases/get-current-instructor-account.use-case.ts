import type {
  GetCurrentInstructorAccountDependencies,
  GetCurrentInstructorAccountQuery,
  GetCurrentInstructorAccountResult,
  GetCurrentInstructorAccountUseCasePort,
} from "../ports/get-current-instructor-account.port.js";
import type { InstructorAccountRepositoryPort } from "../ports/instructor-account-repository.port.js";
import { UnauthorizedTokenError } from "../../domain/errors/domain-errors.js";

/** The Instructor Account a verified Account Token belongs to. */
export class GetCurrentInstructorAccountUseCase
implements GetCurrentInstructorAccountUseCasePort {
  readonly #accountRepo: InstructorAccountRepositoryPort;

  public constructor(deps: GetCurrentInstructorAccountDependencies) {
    this.#accountRepo = deps.accountRepo;
  }

  public async execute(
    query: GetCurrentInstructorAccountQuery,
  ): Promise<GetCurrentInstructorAccountResult> {
    const account = await this.#accountRepo.findById(query.accountId);
    if (!account) {
      // The token is genuine but its account is gone (removed by hand).
      throw new UnauthorizedTokenError("Malformed, invalid, or expired account token.");
    }
    return {
      accountId: account.accountId,
      email: account.email,
      createdAt: account.createdAt,
    };
  }
}
