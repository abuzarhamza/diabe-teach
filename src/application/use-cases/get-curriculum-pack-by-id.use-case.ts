import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  PackNotFoundError,
  UnauthorizedTokenError,
} from "../../domain/errors/domain-errors.js";
import {
  CurriculumPackProjector,
  PublicCurriculumPackDto,
} from "../dtos/curriculum-pack-projector.js";
import { CapabilityTokenPort } from "../ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";

export interface GetCurriculumPackByIdQuery {
  readonly packId: string;
  readonly bearerToken?: string | null;
}

export interface GetCurriculumPackByIdResult {
  readonly pack: PublicCurriculumPackDto;
}

export class GetCurriculumPackByIdUseCase {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #tokenVerifier?: CapabilityTokenPort;

  public constructor(deps: {
    readonly packRepo: CurriculumPackRepositoryPort;
    readonly tokenVerifier?: CapabilityTokenPort;
  }) {
    this.#packRepo = deps.packRepo;
    this.#tokenVerifier = deps.tokenVerifier;
  }

  public async execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult> {
    let callerRole: "anonymous" | "participant" | "instructor" = "anonymous";

    if (query.bearerToken !== undefined && query.bearerToken !== null) {
      if (query.bearerToken.length === 0 || !this.#tokenVerifier) {
        throw new UnauthorizedTokenError(
          "Missing or unconfigured bearer capability token.",
        );
      }
      const verified = await this.#tokenVerifier.verifyToken(query.bearerToken);
      if (!verified) {
        throw new UnauthorizedTokenError("Invalid or unrecognized bearer token.");
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
