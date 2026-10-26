import type { Config } from "@netlify/functions";
import { AppRuntime } from "../../src/app-runtime.js";

export const DEFAULT_MAX_BODY_BYTES = AppRuntime.DEFAULT_MAX_BODY_BYTES;

export default AppRuntime.createServerlessHttpHandler({
  maxBodyBytes: DEFAULT_MAX_BODY_BYTES,
});

export const config: Config = AppRuntime.defineServerlessRouteConfig({
  path: "/api/v1/*",
  method: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ],
});
