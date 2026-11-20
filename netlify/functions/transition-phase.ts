import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./sessions/transition-phase.js";

export { createTransitionPhaseHandler, lambdaHandler } from "./sessions/transition-phase.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/phase",
  method: "POST",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config);
