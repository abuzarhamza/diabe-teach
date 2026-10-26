import type { PublicCurriculumPackDto } from "../dtos/curriculum-pack.dto.js";
import type {
  CapabilityTokenPort,
  VerifiedCapability,
} from "./capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";

export interface GetCurriculumPackByIdQuery {
  readonly packId: string;
  readonly bearerToken?: string | null;
  readonly verifiedCapability?: VerifiedCapability;
}

export interface GetCurriculumPackByIdResult {
  readonly pack: PublicCurriculumPackDto;
}

export interface GetCurriculumPackByIdDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface GetCurriculumPackByIdUseCasePort {
  execute: (
    query: GetCurriculumPackByIdQuery,
  ) => Promise<GetCurriculumPackByIdResult>;
}
