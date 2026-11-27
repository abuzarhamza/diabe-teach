import type { WriteConflictBackoffPort } from "../../application/ports/write-conflict-backoff.port.js";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Waits with real timers. Jitter comes from `Math.random` unless a `random`
 * source is given (for example a seeded one, so a test's delays repeat).
 */
export class TimerWriteConflictBackoff implements WriteConflictBackoffPort {
  readonly #random: () => number;

  public constructor(random: () => number = Math.random) {
    this.#random = random;
  }

  public async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }

  public random(): number {
    return this.#random();
  }
}
