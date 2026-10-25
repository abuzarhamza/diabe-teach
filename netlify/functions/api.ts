import type { Config } from "@netlify/functions";
import { AppRuntime } from "../../src/app-runtime.js";

export default AppRuntime.createServerlessHttpHandler();

export const config: Config = AppRuntime.defineServerlessRouteConfig({
  path: "/api/v1/*",
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
