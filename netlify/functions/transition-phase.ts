import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createTransitionPhaseHandler } from "./sessions/transition-phase.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/phase",
  method: "POST",
};
