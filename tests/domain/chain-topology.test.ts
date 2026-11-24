import { describe, expect, it } from "vitest";
import { ChainTopologyInvalidError } from "../../src/domain/errors/domain-errors.js";
import { ChainTopology } from "../../src/domain/game-session/chain-topology.js";

describe("chainTopology (Chebyshev-8 rule)", () => {
  it("accepts all 8 neighbours and rejects staying put or jumping two cells", () => {
    const from = { row: 3, col: 3 };
    for (const dRow of [-1, 0, 1]) {
      for (const dCol of [-1, 0, 1]) {
        const to = { row: 3 + dRow, col: 3 + dCol };
        expect(ChainTopology.isChebyshev8Step(from, to)).toBe(dRow !== 0 || dCol !== 0);
      }
    }
    expect(ChainTopology.isChebyshev8Step(from, { row: 5, col: 4 })).toBe(false);
    expect(ChainTopology.isChebyshev8Step(from, { row: 3, col: 1 })).toBe(false);
  });

  it("accepts a diagonal path of the minimum length", () => {
    const path = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
    expect(() => ChainTopology.assertValid(path, 3)).not.toThrow();
  });

  it("rejects a path shorter than the minimum", () => {
    expect(() => ChainTopology.assertValid([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ], 3))
      .toThrow(/at least 3 cells/);
  });

  it("rejects a non-adjacent step, naming the positions", () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 3 },
    ];
    expect(() => ChainTopology.assertValid(path, 3)).toThrow(ChainTopologyInvalidError);
    expect(() => ChainTopology.assertValid(path, 3)).toThrow(/positions 1 and 2 are not adjacent/);
  });

  it("rejects a path that revisits a cell", () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 0, col: 0 },
    ];
    expect(() => ChainTopology.assertValid(path, 3)).toThrow(/duplicate cells/);
  });
});
