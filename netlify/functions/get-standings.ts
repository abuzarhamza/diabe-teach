import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createGetStandingsHandler } from "./sessions/get-standings.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/standings",
  method: "GET",
};
