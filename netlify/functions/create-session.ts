import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./sessions/create-session.js";

export { createCreateSessionHandler, lambdaHandler } from "./sessions/create-session.js";

export const config: Config = {
  path: "/api/v1/sessions",
  method: "POST",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
