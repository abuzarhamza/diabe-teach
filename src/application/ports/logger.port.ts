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
 *
 * Call-site rule: log ids (`sessionId`, `packId`, `accountId`,
 * `participantId`) and outcomes (`status`, `errorCode`, `durationMs`). Never
 * pass the `event`, `headers`, a request or response `body`, or a whole domain
 * object, and never a token, password, password hash, email or connection
 * string. The pino adapter's `redact` list is a safety net for mistakes, not
 * permission: it only matches known key names, at most two objects deep.
 */
export interface LoggerPort {
  debug: (fields: LogFields, msg: string) => void;
  info: (fields: LogFields, msg: string) => void;
  warn: (fields: LogFields, msg: string) => void;
  error: (fields: LogFields, msg: string) => void;
  /** Returns a logger that adds `fields` to every line it writes. */
  child: (fields: LogFields) => LoggerPort;
}
