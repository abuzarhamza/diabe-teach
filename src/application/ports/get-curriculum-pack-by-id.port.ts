import { PublicCurriculumPackDto } from "../dtos/curriculum-pack.dto.js";
import {
  CapabilityTokenPort,
  VerifiedCapability,
} from "./capability-token.port.js";
import { CurriculumPackRepositoryPort } from "./curriculum-pack-repository.port.js";

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
  execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult>;
}
