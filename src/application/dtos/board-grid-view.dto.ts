import type { KeywordCard } from "../../domain/curriculum-pack/curriculum-pack.types.js";

/** One cell of a round's board, as documented by `BoardCellView`. */
export interface BoardCellViewDto {
  readonly row: number;
  readonly col: number;
  readonly card: KeywordCard;
}

/** A round's board, as documented by `BoardGridView`: `cells[row][col]`. */
export interface BoardGridViewDto {
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly (readonly BoardCellViewDto[])[];
}
