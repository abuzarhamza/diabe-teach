import type { ClockPort } from "../ports/clock.port.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type {
  RegisterCurriculumPackDependencies,
  RegisterCurriculumPackInput,
  RegisterCurriculumPackResult,
  RegisterCurriculumPackUseCasePort,
} from "../ports/register-curriculum-pack.port.js";
import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { PackValidator } from "../services/pack-validator.js";
import { SilentLogger } from "../services/silent-logger.js";

export class RegisterCurriculumPackUseCase
implements RegisterCurriculumPackUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #clock: ClockPort;

  public constructor(deps: RegisterCurriculumPackDependencies) {
    this.#packRepo = deps.packRepo;
    this.#clock = deps.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: RegisterCurriculumPackInput,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<RegisterCurriculumPackResult> {
    const { pack, accountId } = input;

    const validation = PackValidator.validate(pack, logger);

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

    // The library is shared (ADR-0007): any signed-in teacher may release a
    // new Pack Version of any pack, except a System Pack.
    const latest = await this.#packRepo.findById(PackId.create(pack.id));
    latest?.assertTeachersMayChange();

    // A new version always starts unarchived, so releasing a new version of
    // an archived pack puts it back in the list.
    const curriculumPack = CurriculumPack.create({
      ...pack,
      isSystemPack: false,
      isArchived: false,
      createdBy: accountId,
      authorName: pack.authorName ?? null,
      createdAt: this.#clock.now(),
      archivedAt: null,
      archivedBy: null,
      unarchivedAt: null,
      unarchivedBy: null,
    });

    await this.#packRepo.create(curriculumPack);
    logger.info(
      { packId: curriculumPack.id.value, version: curriculumPack.version, accountId },
      "pack registered",
    );

    return {
      success: true,
      packId: curriculumPack.id.value,
      version: curriculumPack.version,
      warnings: validation.warnings,
    };
  }
}
