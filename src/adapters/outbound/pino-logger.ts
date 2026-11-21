import type { DestinationStream, Logger } from "pino";
import type { LogFields, LoggerPort, LogLevel } from "../../application/ports/logger.port.js";
import type { PinoLoggerOptions, PrettyStreamFactory } from "./pino-logger.types.js";
import { createRequire } from "node:module";
import { pino } from "pino";

export const LOG_SERVICE_NAME = "diabe-teach-api";

export const LOG_LEVELS: readonly LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
];

/**
 * pino behind the `LoggerPort`. One JSON object per line, written
 * synchronously (no worker-thread transports, which can lose lines when a
 * serverless function or netlify dev worker exits).
 */
export class PinoLogger implements LoggerPort {
  readonly #logger: Logger;

  private constructor(logger: Logger) {
    this.#logger = logger;
  }

  public static create(options: PinoLoggerOptions): PinoLogger {
    const logger = pino(
      {
        level: options.level,
        // Replaces pino's default base, so lines carry no `pid` or `hostname`.
        base: { service: LOG_SERVICE_NAME },
        formatters: {
          level: label => ({ level: label }),
        },
      },
      PinoLogger.#destination(options),
    );
    return new PinoLogger(logger);
  }

  public static isLogLevel(value: string): value is LogLevel {
    return (LOG_LEVELS as readonly string[]).includes(value);
  }

  static #destination(options: PinoLoggerOptions): DestinationStream {
    if (options.pretty) {
      const prettyStream = PinoLogger.#loadPrettyStream(options.destination);
      if (prettyStream) {
        return prettyStream;
      }
    }
    return options.destination ?? pino.destination({ dest: 1, sync: true });
  }

  /**
   * pino-pretty is a devDependency, loaded only when pretty output is asked
   * for (under netlify dev). A deployed bundle without it falls back to JSON.
   */
  static #loadPrettyStream(destination?: NodeJS.WritableStream): DestinationStream | undefined {
    try {
      const required = createRequire(import.meta.url)("pino-pretty") as PrettyStreamFactory | { default: PrettyStreamFactory };
      const pretty = typeof required === "function"
        ? required
        : required.default;
      return pretty({ sync: true, colorize: destination === undefined, destination });
    }
    catch {
      return undefined;
    }
  }

  public debug(fields: LogFields, msg: string): void {
    this.#logger.debug(fields, msg);
  }

  public info(fields: LogFields, msg: string): void {
    this.#logger.info(fields, msg);
  }

  public warn(fields: LogFields, msg: string): void {
    this.#logger.warn(fields, msg);
  }

  public error(fields: LogFields, msg: string): void {
    this.#logger.error(fields, msg);
  }

  public child(fields: LogFields): LoggerPort {
    return new PinoLogger(this.#logger.child(fields));
  }
}
