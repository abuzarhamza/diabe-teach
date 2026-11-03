import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createAdjudicateChainHandler } from "./sessions/adjudicate-chain.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate",
  method: "POST",
};
