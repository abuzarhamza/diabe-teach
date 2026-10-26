import type { CapabilityTokenPort } from "../ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type {
  GetCurriculumPackByIdDependencies,
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdResult,
  GetCurriculumPackByIdUseCasePort,
} from "../ports/get-curriculum-pack-by-id.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../domain/errors/domain-errors.js";
import { CurriculumPackProjector } from "../dtos/curriculum-pack-projector.js";

export class GetCurriculumPackByIdUseCase
implements GetCurriculumPackByIdUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #tokenVerifier?: CapabilityTokenPort;

  public constructor(deps: GetCurriculumPackByIdDependencies) {
    this.#packRepo = deps.packRepo;
    this.#tokenVerifier = deps.tokenVerifier;
  }

  public async execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult> {
    const callerRole = await this.#resolveCallerRole(query);
    const pack = await this.#loadPack(query.packId);

    return {
      pack: CurriculumPackProjector.toPublicDto(pack, {
        includeAnswerKeys: callerRole === "instructor",
      }),
    };
  }

  async #resolveCallerRole(
    query: GetCurriculumPackByIdQuery,
  ): Promise<"anonymous" | "participant" | "instructor"> {
    if (query.verifiedCapability) {
      return query.verifiedCapability.role;
    }
    if (query.bearerToken === undefined || query.bearerToken === null) {
      return "anonymous";
    }
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
    return verified.role;
  }

  async #loadPack(rawPackId: string) {
    const packId = PackId.create(rawPackId);
    const pack = await this.#packRepo.findById(packId);
    if (!pack) {
      throw new PackNotFoundError(packId.value);
    }
    return pack;
  }
}
