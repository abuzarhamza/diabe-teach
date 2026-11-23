import type { SeededRandomPort } from "../../application/ports/board-randomness.port.js";
import type { SeededRandom } from "../../domain/game-session/round-board.types.js";
import seedrandom from "seedrandom";

/**
 * Seeded PRNG backed by the `seedrandom` package (its default ARC4-based
 * generator), which gives the same sequence for a seed on every platform.
 */
export class SeedrandomSeededRandom implements SeededRandomPort {
  public forSeed(seed: string): SeededRandom {
    const prng = seedrandom(seed);
    return () => prng();
  }
}
