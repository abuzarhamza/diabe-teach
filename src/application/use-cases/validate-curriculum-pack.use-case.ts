import type { LoggerPort } from "../ports/logger.port.js";
import type {
  ValidateCurriculumPackInput,
  ValidateCurriculumPackResult,
  ValidateCurriculumPackUseCasePort,
} from "../ports/validate-curriculum-pack.port.js";
import { PackValidator } from "../services/pack-validator.js";
import { SilentLogger } from "../services/silent-logger.js";

export class ValidateCurriculumPackUseCase
implements ValidateCurriculumPackUseCasePort {
  public async execute(
    input: ValidateCurriculumPackInput,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<ValidateCurriculumPackResult> {
    return PackValidator.validate(input.pack, logger);
  }
}
