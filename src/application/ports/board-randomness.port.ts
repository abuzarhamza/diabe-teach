import type { SeededRandom } from "../../domain/game-session/round-board.types.js";

/**
 * Outbound port for the seeded pseudo-random generator that shuffles a
 * round's board. The same seed must give the same sequence in every
 * environment, so a seed always reproduces its board.
 */
export interface SeededRandomPort {
  forSeed: (seed: string) => SeededRandom;
}

/**
 * Outbound port for picking a fresh board seed when the instructor gave
 * none, so each class gets a different board.
 */
export interface BoardSeedGeneratorPort {
  nextSeed: () => string;
}
