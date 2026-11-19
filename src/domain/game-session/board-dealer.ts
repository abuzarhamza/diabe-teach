import type { KeywordCard } from "../curriculum-pack/curriculum-pack.types.js";
import type { DealRoundBoardRequest, RoundBoard, SeededRandom } from "./round-board.types.js";
import { InvalidBoardSeedError, NotEnoughKeywordCardsError } from "../errors/domain-errors.js";

/**
 * Deals a Gameplay Round's board: shuffles the pack's Keyword Cards with a
 * Fisher–Yates shuffle driven by a PRNG seeded with the board's seed, takes
 * the first `rows × cols` cards and fills the grid row by row. The same
 * cards, size and seeded PRNG always give the same board.
 */
export class BoardDealer {
  public static deal(request: DealRoundBoardRequest, random: SeededRandom): RoundBoard {
    const { roundNumber, seed, rows, cols, cards } = request;
    const cellCount = rows * cols;
    if (cards.length < cellCount) {
      throw new NotEnoughKeywordCardsError(cards.length, rows, cols);
    }

    const shuffled = cards.map(BoardDealer.#snapshot);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    const cells: KeywordCard[][] = [];
    for (let row = 0; row < rows; row++) {
      cells.push(shuffled.slice(row * cols, (row + 1) * cols));
    }
    return { roundNumber, seed, rows, cols, cells };
  }

  /**
   * A board seed, when given, must be a non-empty string. `field` names the
   * request field for the error.
   */
  public static assertValidSeed(seed: unknown, field: string): asserts seed is string | undefined {
    if (seed !== undefined && (typeof seed !== "string" || seed.length === 0)) {
      throw new InvalidBoardSeedError(field, seed);
    }
  }

  static #snapshot(card: KeywordCard): KeywordCard {
    return {
      id: card.id,
      verbatimLabel: card.verbatimLabel,
      displayLabel: card.displayLabel,
      aliases: [...card.aliases],
      domainId: card.domainId,
      summary: card.summary,
    };
  }
}
