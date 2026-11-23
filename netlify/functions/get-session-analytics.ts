import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./sessions/get-session-analytics.js";

export { createGetSessionAnalyticsHandler, lambdaHandler } from "./sessions/get-session-analytics.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/analytics",
  method: "GET",
};

// Routed by `config.path` alone (no netlify.toml redirect).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
