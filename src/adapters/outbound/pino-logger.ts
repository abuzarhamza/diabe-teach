import type { DestinationStream, Logger } from "pino";
import type { LogFields, LoggerPort, LogLevel } from "../../application/ports/logger.port.js";
import type { PinoLoggerOptions, PrettyStreamFactory } from "./pino-logger.types.js";
import { createRequire } from "node:module";
import { pino } from "pino";
import { MongoCredentialStripper } from "./mongo-credential-stripper.js";

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
 * Keys whose values never reach the logs. A safety net only: call sites log
 * ids and outcomes, never these (see `LoggerPort`).
 */
export const REDACTED_KEYS: readonly string[] = [
  "authorization",
  "token",
  "accountToken",
  "instructorToken",
  "participantToken",
  "password",
  "passwordHash",
  "email",
  "body",
  "mongodbUri",
  "uri",
];

/**
 * pino `redact` paths for `REDACTED_KEYS`. In pino's path syntax each `*`
 * stands for exactly one key: `*.email` matches `{ account: { email } }` but
 * neither a top-level `email` nor `{ a: { b: { email } } }`. So every key is
 * listed at depth 0, 1 and 2 (`email`, `*.email`, `*.*.email`), which covers
 * `{ req: { headers: { authorization } } }`. Deeper nesting and values inside
 * arrays are not matched.
 */
export const REDACT_PATHS: readonly string[] = REDACTED_KEYS.flatMap(key => [
  key,
  `*.${key}`,
  `*.*.${key}`,
]);

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
        redact: {
          paths: [
            ...(options.redactPaths ?? REDACT_PATHS),
          ],
          remove: true,
        },
        serializers: { err: PinoLogger.#serializeError },
      },
      PinoLogger.#destination(options),
    );
    return new PinoLogger(logger);
  }

  /** pino's error serializer, with MongoDB credentials stripped from the message and stack. */
  static #serializeError(err: Error): ReturnType<typeof pino.stdSerializers.err> {
    const serialized = pino.stdSerializers.err(err);
    if (typeof serialized.message === "string") {
      serialized.message = MongoCredentialStripper.strip(serialized.message);
    }
    if (typeof serialized.stack === "string") {
      serialized.stack = MongoCredentialStripper.strip(serialized.stack);
    }
    return serialized;
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
