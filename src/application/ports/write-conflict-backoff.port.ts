/**
 * Outbound port for the wait between Game Session write-conflict retries, so
 * the retrier never touches timers or `Math.random` directly and tests can
 * run retries without sleeping.
 */
export interface WriteConflictBackoffPort {
  /** Resolves after `ms` milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** A uniform random fraction in [0, 1), used for full jitter. */
  random: () => number;
}
