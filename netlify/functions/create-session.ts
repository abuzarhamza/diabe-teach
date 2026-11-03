import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createCreateSessionHandler } from "./sessions/create-session.js";

export const config: Config = {
  path: "/api/v1/sessions",
  method: "POST",
};
