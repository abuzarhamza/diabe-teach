import type {
  ValidateCurriculumPackInput,
  ValidateCurriculumPackResult,
  ValidateCurriculumPackUseCasePort,
} from "../ports/validate-curriculum-pack.port.js";
import { PackValidator } from "../services/pack-validator.js";

export class ValidateCurriculumPackUseCase
implements ValidateCurriculumPackUseCasePort {
  public async execute(
    input: ValidateCurriculumPackInput,
  ): Promise<ValidateCurriculumPackResult> {
    return PackValidator.validate(input.pack);
  }
}
