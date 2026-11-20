import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./accounts/get-current-account.js";

export { createGetCurrentAccountHandler, lambdaHandler } from "./accounts/get-current-account.js";

export const config: Config = {
  path: "/api/v1/accounts/me",
  method: "GET",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
