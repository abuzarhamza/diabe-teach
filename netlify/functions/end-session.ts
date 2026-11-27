import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./sessions/end-session.js";

export { createEndSessionHandler, lambdaHandler } from "./sessions/end-session.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/end",
  method: "POST",
};

// Routed by `config.path` alone (no netlify.toml redirect).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
