/**
 * Outbound port for reading the current time, so use cases never touch the
 * wall clock directly and tests can control time without sleeping.
 */
export interface ClockPort {
  now: () => Date;
}
