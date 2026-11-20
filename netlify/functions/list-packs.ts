import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { AppRuntime } from "../../src/app-runtime.js";
import { lambdaHandler } from "./packs/list-packs.js";

export { createListPacksHandler, lambdaHandler } from "./packs/list-packs.js";

export const config: Config = {
  path: "/api/v1/packs",
  method: "GET",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);
