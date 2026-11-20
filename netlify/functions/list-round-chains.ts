import type { Config } from "@netlify/functions";

export { createListRoundChainsHandler, default, lambdaHandler } from "./sessions/list-round-chains.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains",
  method: "GET",
};
