import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { PackId } from "../../domain/curriculum-pack/pack-id.js";

/**
 * Stores every Pack Version of every Curriculum Pack. Lookups by pack id
 * alone return the latest version (highest semver); a running Game Session
 * reads its pinned version with `findByIdAndVersion`.
 */
export interface CurriculumPackRepositoryPort {
  /** The latest version of the pack, or `null` when it has none. */
  findById: (packId: PackId) => Promise<CurriculumPack | null>;
  /** That exact Pack Version, or `null` when it was never registered. */
  findByIdAndVersion: (packId: PackId, version: string) => Promise<CurriculumPack | null>;
  /** The latest version of every pack. */
  findAll: () => Promise<readonly CurriculumPack[]>;
  /** The latest version of every pack whose latest version is not archived. */
  findAllActive: () => Promise<readonly CurriculumPack[]>;
  create: (pack: CurriculumPack) => Promise<void>;
  /** Replaces the stored Pack Version matching the pack's id and version. */
  update: (pack: CurriculumPack) => Promise<void>;
  existsByIdAndVersion: (packId: string, version: string) => Promise<boolean>;
}
