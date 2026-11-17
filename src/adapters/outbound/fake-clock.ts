import type { ClockPort } from "../../application/ports/clock.port.js";

export class FakeClock implements ClockPort {
  #currentMs: number;

  public constructor(initial: Date = new Date("2026-01-01T00:00:00.000Z")) {
    this.#currentMs = initial.getTime();
  }

  public now(): Date {
    return new Date(this.#currentMs);
  }

  public setNow(date: Date): void {
    this.#currentMs = date.getTime();
  }

  public advanceSeconds(seconds: number): void {
    this.#currentMs += seconds * 1000;
  }
}
