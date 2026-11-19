import type { TestWorld } from "../support/world.js";
import { Then, When } from "@cucumber/cucumber";
import { expect } from "chai";

interface BoardGridView {
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly (readonly { row: number; col: number; card: { id: string } }[])[];
}

function activeBoardOf(world: TestWorld): BoardGridView | null | undefined {
  const body = world.lastResponseBody as { state?: { activeBoard?: BoardGridView | null } };
  return body.state?.activeBoard;
}

Then(
  "the session should have no active board",
  function (this: TestWorld) {
    expect(activeBoardOf(this)).to.equal(null);
  },
);

Then(
  "the active board should be a {int} by {int} grid of distinct Keyword Cards",
  function (this: TestWorld, rows: number, cols: number) {
    const board = activeBoardOf(this);
    expect(board, "activeBoard").to.be.an("object");
    expect(board!.seed).to.be.a("string").and.not.equal("");
    expect(board!.rows).to.equal(rows);
    expect(board!.cols).to.equal(cols);
    expect(board!.cells).to.have.length(rows);
    const ids = board!.cells.flatMap((row, rowIndex) => {
      expect(row).to.have.length(cols);
      return row.map((cell, colIndex) => {
        expect(cell.row).to.equal(rowIndex);
        expect(cell.col).to.equal(colIndex);
        return cell.card.id;
      });
    });
    expect(new Set(ids).size).to.equal(rows * cols);
  },
);

When(
  "the instructor notes the active board",
  function (this: TestWorld) {
    this.notedBoard = activeBoardOf(this);
    expect(this.notedBoard, "activeBoard").to.be.an("object");
  },
);

Then(
  "the active board should be the noted board",
  function (this: TestWorld) {
    expect(activeBoardOf(this)).to.deep.equal(this.notedBoard);
  },
);
