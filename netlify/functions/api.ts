import type { Config } from "@netlify/functions";
import {
  createServerlessHttpHandler,
  defineServerlessRouteConfig,
} from "../../src/config/runtime.config.js";

export default createServerlessHttpHandler();

export const config: Config = defineServerlessRouteConfig({
  path: "/api/v1/*",
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
