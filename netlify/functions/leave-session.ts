import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./sessions/leave-session.js";

export { createLeaveSessionHandler, lambdaHandler } from "./sessions/leave-session.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/leave",
  method: "POST",
};

// Routed by `config.path` alone (no netlify.toml redirect).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
