import { createApp } from "../../src/adapters/inbound/http/create-app.js";
import { createNetlifyFunctionHandler } from "../config/create-netlify-function-handler.js";
import { defineNetlifyRouteConfig } from "../config/netlify-runtime.config.js";

export default createNetlifyFunctionHandler((deps) => {
  const app = createApp(deps);
  return (request, context) => app.fetch(request, context);
});

export const config = defineNetlifyRouteConfig({
  path: "/api/v1/*",
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
