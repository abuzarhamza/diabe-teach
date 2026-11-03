import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type {
  RegisterCurriculumPackDependencies,
  RegisterCurriculumPackInput,
  RegisterCurriculumPackResult,
  RegisterCurriculumPackUseCasePort,
} from "../ports/register-curriculum-pack.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { PackValidator } from "../services/pack-validator.js";

export class RegisterCurriculumPackUseCase
implements RegisterCurriculumPackUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: RegisterCurriculumPackDependencies) {
    this.#packRepo = deps.packRepo;
  }

  public async execute(
    input: RegisterCurriculumPackInput,
  ): Promise<RegisterCurriculumPackResult> {
    const { pack, instructorSessionId } = input;

    const validation = PackValidator.validate(pack);

    if (!validation.valid) {
      return {
        success: false,
        code: "PACK_VALIDATION_FAILED",
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    const exists = await this.#packRepo.existsByIdAndVersion(
      pack.id,
      pack.version,
    );

    if (exists) {
      return {
        success: false,
        code: "PACK_ALREADY_EXISTS",
        packId: pack.id,
        version: pack.version,
      };
    }

    const curriculumPack = CurriculumPack.create({
      ...pack,
      isSystemPack: false,
      isArchived: false,
      createdBy: instructorSessionId,
      authorName: pack.authorName ?? null,
      createdAt: new Date(),
      archivedAt: null,
    });

    await this.#packRepo.create(curriculumPack);

    return {
      success: true,
      packId: curriculumPack.id.value,
      version: curriculumPack.version,
      warnings: validation.warnings,
    };
  }
}
