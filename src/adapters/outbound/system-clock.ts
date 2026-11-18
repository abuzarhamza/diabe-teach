import type { ClockPort } from "../../application/ports/clock.port.js";

export class SystemClock implements ClockPort {
  public now(): Date {
    return new Date();
  }
}
