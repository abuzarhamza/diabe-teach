import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import { PackNotFoundError } from "../../domain/errors/domain-errors.js";
import { SilentLogger } from "./silent-logger.js";

/**
 * Loads the Curriculum Pack a Game Session plays: its pinned Pack Version,
 * or the latest version for sessions stored before versions were pinned.
 */
export class SessionPackLoader {
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(packRepo: CurriculumPackRepositoryPort) {
    this.#packRepo = packRepo;
  }

  /**
   * Throws PackNotFoundError when the session's pack (or version) is not
   * stored. Logs at `debug` which version was read and whether it fell back
   * to the latest (a session stored before pinning).
   */
  public async load(session: GameSession, logger: LoggerPort = new SilentLogger()): Promise<CurriculumPack> {
    const packId = PackId.create(session.packId);
    const pinnedVersion = session.packVersion;
    const fellBackToLatest = pinnedVersion === null;
    const pack = pinnedVersion === null
      ? await this.#packRepo.findById(packId)
      : await this.#packRepo.findByIdAndVersion(packId, pinnedVersion);
    if (!pack) {
      throw new PackNotFoundError(session.packId);
    }
    logger.debug(
      { packId: session.packId, packVersion: pack.version, fellBackToLatest },
      "session pack loaded",
    );
    return pack;
  }
}
