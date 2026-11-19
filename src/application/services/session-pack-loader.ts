import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { PackNotFoundError } from "../../domain/errors/domain-errors.js";

/**
 * Loads the Curriculum Pack a Game Session plays: its pinned Pack Version,
 * or the latest version for sessions stored before versions were pinned.
 */
export class SessionPackLoader {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(packRepo: CurriculumPackRepositoryPort) {
    this.#packRepo = packRepo;
  }

  /** Throws PackNotFoundError when the session's pack (or version) is not stored. */
  public async load(session: GameSession): Promise<CurriculumPack> {
    const packId = PackId.create(session.packId);
    const pack = session.packVersion === null
      ? await this.#packRepo.findById(packId)
      : await this.#packRepo.findByIdAndVersion(packId, session.packVersion);
    if (!pack) {
      throw new PackNotFoundError(session.packId);
    }
    return pack;
  }
}
