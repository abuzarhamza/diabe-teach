import type { LoggerPort } from "../../../application/ports/logger.port.js";

/**
 * The part of a Netlify Functions v2 `config` the wrapper needs: the route's
 * declared path (or paths), for example `/api/v1/packs/:packId/archive`.
 * Structurally compatible with `Config` from `@netlify/functions`.
 */
export interface RouteConfig {
  readonly path?: string | readonly string[];
}

/**
 * Optional hooks around one invocation, supplied by the composition root.
 * `afterInvocation` runs once the handler has finished (answered or thrown),
 * before the response is handed back. `logger` is the base logger; the
 * wrapper makes one child of it per invocation. Without one, nothing is
 * logged (`SilentLogger`).
 */
export interface WrapLambdaHandlerOptions {
  readonly afterInvocation?: () => Promise<void>;
  readonly logger?: LoggerPort;
}

/**
 * What the middy chain learns about an invocation's outcome and reports back
 * to the wrapper for the `request completed` line. A mutable holder, so it
 * survives middlewares that copy the event.
 */
export interface RequestOutcome {
  /** The DomainError `code` of a refusal, set by `domainErrorMiddleware`. */
  errorCode?: string;
}

/**
 * Fields the wrapper adds to every event it hands to a handler. `logger` is
 * the per-invocation child carrying `requestId`, `route` and `method`. An
 * event built by a test without the wrapper has neither, so readers treat
 * them as optional.
 */
export interface RequestLogFields {
  readonly logger: LoggerPort;
  readonly requestOutcome: RequestOutcome;
}
