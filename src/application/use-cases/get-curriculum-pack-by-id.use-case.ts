import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../domain/errors/domain-errors.js";
import { CurriculumPackProjector } from "../dtos/curriculum-pack-projector.js";
import { CapabilityTokenPort } from "../ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import {
  GetCurriculumPackByIdDependencies,
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdResult,
  GetCurriculumPackByIdUseCasePort,
} from "../ports/get-curriculum-pack-by-id.port.js";

export class GetCurriculumPackByIdUseCase
  implements GetCurriculumPackByIdUseCasePort
{
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #tokenVerifier?: CapabilityTokenPort;

  public constructor(deps: GetCurriculumPackByIdDependencies) {
    this.#packRepo = deps.packRepo;
    this.#tokenVerifier = deps.tokenVerifier;
  }

  public async execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult> {
    let callerRole: "anonymous" | "participant" | "instructor" = "anonymous";

    if (query.verifiedCapability) {
      callerRole = query.verifiedCapability.role;
    } else if (query.bearerToken !== undefined && query.bearerToken !== null) {
      if (query.bearerToken.length === 0 || !this.#tokenVerifier) {
        throw new UnauthorizedTokenError(
          "Missing or unconfigured bearer capability token.",
        );
      }
      const verified = await this.#tokenVerifier.verifyToken(query.bearerToken);
      if (!verified) {
        throw new UnauthorizedTokenError(
          "Invalid or unrecognized bearer token.",
        );
      }
      callerRole = verified.role;
    }

    const packId = PackId.create(query.packId);
    const pack = await this.#packRepo.findById(packId);
    if (!pack) {
      throw new PackNotFoundError(packId.value);
    }

    return {
      pack: CurriculumPackProjector.toPublicDto(pack, {
        includeAnswerKeys: callerRole === "instructor",
      }),
    };
  }
}
