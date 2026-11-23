import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./packs/register-pack.js";

export { createRegisterPackHandler, lambdaHandler } from "./packs/register-pack.js";

export const config: Config = {
  path: "/api/v1/packs",
  method: "POST",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config);
