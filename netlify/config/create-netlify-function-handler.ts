import { createApp } from "../../src/adapters/inbound/http/create-app.js";
import { getNetlifyProductionDependencies } from "./netlify-runtime.config.js";
import {
  NetlifyFunctionContext,
  NetlifyFunctionHandler,
  NetlifyProductionDependencies,
} from "./netlify-runtime.types.js";

/**
 * Single-entrypoint Netlify Function v2 handler adapter.
 * Wires shared production Outbound Adapters into `createApp(deps)` (`openapi-backend`)
 * and forwards `(request, { params: context?.params })`.
 */
export function createNetlifyFunctionHandler(
  deps: NetlifyProductionDependencies = getNetlifyProductionDependencies(),
): NetlifyFunctionHandler {
  const app = createApp(deps);

  return async function netlifyFunctionHandler(
    request: Request,
    context: NetlifyFunctionContext,
  ): Promise<Response> {
    return app.fetch(request, {
      params: context?.params,
    });
  };
}
