import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createGetSessionHandler } from "./sessions/get-session.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId",
  method: "GET",
};
