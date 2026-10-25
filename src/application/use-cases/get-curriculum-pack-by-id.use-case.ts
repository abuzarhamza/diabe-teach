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
  readonly authorizationHeader?: string | null;
}

export interface GetCurriculumPackByIdResult {
  readonly pack: PublicCurriculumPackDto;
}

function extractBearerToken(authorizationHeader: string): string {
  const match = /^Bearer\s+(\S+)$/.exec(authorizationHeader.trim());
  if (!match || !match[1]) {
    throw new UnauthorizedTokenError(
      "Malformed Authorization header. Expected 'Bearer <token>'.",
    );
  }
  return match[1];
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

    if (
      query.authorizationHeader !== undefined &&
      query.authorizationHeader !== null
    ) {
      const rawToken = extractBearerToken(query.authorizationHeader);
      if (!this.#tokenVerifier) {
        throw new UnauthorizedTokenError("Token verification is not configured.");
      }
      const verified = await this.#tokenVerifier.verifyToken(rawToken);
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
