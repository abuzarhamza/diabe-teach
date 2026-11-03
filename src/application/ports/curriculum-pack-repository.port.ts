import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { PackId } from "../../domain/curriculum-pack/pack-id.js";

export interface CurriculumPackRepositoryPort {
  findById: (packId: PackId) => Promise<CurriculumPack | null>;
  findAll: () => Promise<readonly CurriculumPack[]>;
  findAllActive: () => Promise<readonly CurriculumPack[]>;
  create: (pack: CurriculumPack) => Promise<void>;
  update: (pack: CurriculumPack) => Promise<void>;
  existsByIdAndVersion: (packId: string, version: string) => Promise<boolean>;
}
