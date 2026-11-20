import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./packs/get-pack-by-id.js";

export { createGetPackByIdHandler, lambdaHandler } from "./packs/get-pack-by-id.js";

export const config: Config = {
  path: "/api/v1/packs/:packId",
  method: "GET",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config);
