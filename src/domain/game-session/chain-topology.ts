import type { GridCoord } from "./concept-chain.js";
import { ChainTopologyInvalidError } from "../errors/domain-errors.js";

/**
 * The shape rule every Concept Chain path must meet on the board: at least the
 * pack's minimum number of cells, each step to one of the 8 surrounding cells
 * (Chebyshev distance 1), and no cell visited twice.
 */
export class ChainTopology {
  /** True when `to` is one of the 8 cells around `from` (Chebyshev distance exactly 1). */
  public static isChebyshev8Step(from: GridCoord, to: GridCoord): boolean {
    return Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col)) === 1;
  }

  /**
   * Throws `ChainTopologyInvalidError` unless `path` has at least
   * `minChainLength` cells, every step is a Chebyshev-8 step, and no cell repeats.
   */
  public static assertValid(path: readonly GridCoord[], minChainLength: number): void {
    if (path.length < minChainLength) {
      throw new ChainTopologyInvalidError(
        `Chain must have at least ${minChainLength} cells`,
      );
    }

    for (let i = 1; i < path.length; i++) {
      if (!ChainTopology.isChebyshev8Step(path[i - 1]!, path[i]!)) {
        throw new ChainTopologyInvalidError(
          `Cells at positions ${i - 1} and ${i} are not adjacent`,
        );
      }
    }

    const seen = new Set<string>();
    for (const coord of path) {
      const key = `${coord.row},${coord.col}`;
      if (seen.has(key)) {
        throw new ChainTopologyInvalidError("Chain contains duplicate cells");
      }
      seen.add(key);
    }
  }
}
