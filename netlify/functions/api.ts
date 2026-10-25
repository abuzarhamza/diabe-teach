import { createNetlifyFunctionHandler } from "../config/create-netlify-function-handler.js";
import { defineNetlifyRouteConfig } from "../config/netlify-runtime.config.js";

export default createNetlifyFunctionHandler();

export const config = defineNetlifyRouteConfig({
  path: "/api/v1/*",
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
