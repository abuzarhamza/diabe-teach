import type { LoggerPort } from "../../../application/ports/logger.port.js";
import type { RequestLogFields } from "./lambda-to-v2-wrapper.types.js";
import { SilentLogger } from "../../../application/services/silent-logger.js";

/**
 * The request's logger: the per-invocation child the wrapper put on the
 * event (it carries `requestId`, `route` and `method`). An event built
 * without the wrapper (a handler test) has none, so nothing is logged.
 * Handlers pass it to `useCase.execute(command, logger)`.
 */
export function requestLoggerOf(event: unknown): LoggerPort {
  return (event as Partial<RequestLogFields> | undefined)?.logger ?? new SilentLogger();
}
