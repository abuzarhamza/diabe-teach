/**
 * The part of a Netlify Functions v2 `config` the wrapper needs: the route's
 * declared path (or paths), for example `/api/v1/packs/:packId/archive`.
 * Structurally compatible with `Config` from `@netlify/functions`.
 */
export interface RouteConfig {
  readonly path?: string | readonly string[];
}
