import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createJoinSessionHandler } from "./sessions/join-session.js";

export const config: Config = {
  path: "/api/v1/sessions/join",
  method: "POST",
};
