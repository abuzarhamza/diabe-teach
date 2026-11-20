import type { KeywordCard } from "../curriculum-pack/curriculum-pack.types.js";

/**
 * The board dealt for one Gameplay Round: the pack's Keyword Cards shuffled
 * into a `rows × cols` grid. `cells[row][col]` holds a copy of the card
 * placed there, so later changes to the Curriculum Pack never alter it.
 */
export interface RoundBoard {
  readonly roundNumber: 1 | 2;
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly (readonly KeywordCard[])[];
}

/**
 * A seeded pseudo-random number generator: each call returns the next number
 * in [0, 1) of the sequence its seed determines.
 */
export type SeededRandom = () => number;

/** What a round's board is dealt from. */
export interface DealRoundBoardRequest {
  readonly roundNumber: 1 | 2;
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly cards: readonly KeywordCard[];
}
