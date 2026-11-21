/**
 * Structured fields attached to one log line. Keep them to ids and outcomes
 * (for example `sessionId`, `status`); never tokens, passwords, emails,
 * headers, request bodies or whole domain objects.
 */
export type LogFields = Readonly<Record<string, unknown>>;

/** The minimum level a logger writes; `silent` writes nothing. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/**
 * Outbound port for structured logging, so domain and application code never
 * import a logging library. Each method writes one line with `fields` and `msg`.
 */
export interface LoggerPort {
  debug: (fields: LogFields, msg: string) => void;
  info: (fields: LogFields, msg: string) => void;
  warn: (fields: LogFields, msg: string) => void;
  error: (fields: LogFields, msg: string) => void;
  /** Returns a logger that adds `fields` to every line it writes. */
  child: (fields: LogFields) => LoggerPort;
}
