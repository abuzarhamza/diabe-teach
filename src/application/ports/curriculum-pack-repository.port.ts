import { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";

export interface CurriculumPackRepositoryPort {
  findById(packId: PackId): Promise<CurriculumPack | null>;
}
