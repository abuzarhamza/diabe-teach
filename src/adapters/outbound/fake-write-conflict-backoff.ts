import type { WriteConflictBackoffPort } from "../../application/ports/write-conflict-backoff.port.js";

/**
 * Test backoff: never waits, records every requested delay, and returns a
 * fixed jitter fraction so the delays are deterministic.
 */
export class FakeWriteConflictBackoff implements WriteConflictBackoffPort {
  readonly #fraction: number;
  public readonly sleeps: number[] = [];

  /** `fraction` is what `random()` returns, in [0, 1). */
  public constructor(fraction = 0.5) {
    this.#fraction = fraction;
  }

  public async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
  }

  public random(): number {
    return this.#fraction;
  }
}
