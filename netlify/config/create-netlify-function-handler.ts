import { getNetlifyProductionDependencies } from "./netlify-runtime.config.js";
import {
  DrivingHandlerFactory,
  NetlifyFunctionContext,
  NetlifyFunctionHandler,
  NetlifyProductionDependencies,
} from "./netlify-runtime.types.js";

/**
 * Common Netlify Function v2 handler adapter.
 * Wires shared production Driven Adapters into the endpoint's Driving Adapter factory
 * and forwards `(request, { params: context?.params })`.
 */
export function createNetlifyFunctionHandler(
  createDrivingHandler: DrivingHandlerFactory<NetlifyProductionDependencies>,
  deps: NetlifyProductionDependencies = getNetlifyProductionDependencies(),
): NetlifyFunctionHandler {
  const endpointHandler = createDrivingHandler(deps);

  return async function netlifyFunctionHandler(
    request: Request,
    context: NetlifyFunctionContext,
  ): Promise<Response> {
    return endpointHandler(request, {
      params: context?.params,
    });
  };
}
