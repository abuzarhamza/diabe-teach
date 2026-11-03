import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createSubmitChainHandler } from "./sessions/submit-chain.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains",
  method: "POST",
};
