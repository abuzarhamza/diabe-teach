import { createGetPackByIdHandler } from "../../src/adapters/inbound/http/get-pack-by-id.handler.js";
import { createNetlifyFunctionHandler } from "../config/create-netlify-function-handler.js";
import { defineNetlifyRouteConfig } from "../config/netlify-runtime.config.js";

export default createNetlifyFunctionHandler(createGetPackByIdHandler);

export const config = defineNetlifyRouteConfig({
  path: "/api/v1/packs/:packId",
  method: "GET",
});
