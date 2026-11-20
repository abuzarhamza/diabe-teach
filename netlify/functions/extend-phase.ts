import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./sessions/extend-phase.js";

export { createExtendPhaseHandler, lambdaHandler } from "./sessions/extend-phase.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/phase/extend",
  method: "POST",
};

// Routed by `config.path` alone (no netlify.toml redirect).
export default wrapLambdaHandler(lambdaHandler, config);
