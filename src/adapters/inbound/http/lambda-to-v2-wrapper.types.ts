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
 * before the response is handed back.
 */
export interface WrapLambdaHandlerOptions {
  readonly afterInvocation?: () => Promise<void>;
}
