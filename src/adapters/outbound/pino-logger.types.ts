import type { DestinationStream } from "pino";
import type { LogLevel } from "../../application/ports/logger.port.js";

export interface PinoLoggerOptions {
  readonly level: LogLevel;
  /** Human-readable output through pino-pretty; falls back to JSON if it can't load. */
  readonly pretty?: boolean;
  /**
   * Where lines are written. Defaults to stdout through a synchronous
   * `pino.destination`. Tests pass an in-memory stream.
   */
  readonly destination?: NodeJS.WritableStream;
  /** Overrides the default `REDACT_PATHS`; only tests set it (to prove the redaction test bites). */
  readonly redactPaths?: readonly string[];
}

/** The part of pino-pretty's default export this adapter uses. */
export type PrettyStreamFactory = (options: {
  sync: boolean;
  colorize: boolean;
  destination?: NodeJS.WritableStream;
}) => DestinationStream;
