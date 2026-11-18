import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createSubmitAssessmentHandler } from "./sessions/submit-assessment.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/assessments/:stage",
  method: "POST",
};
