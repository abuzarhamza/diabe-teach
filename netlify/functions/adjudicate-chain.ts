import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./sessions/adjudicate-chain.js";

export { createAdjudicateChainHandler, lambdaHandler } from "./sessions/adjudicate-chain.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
  method: "POST",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config);
