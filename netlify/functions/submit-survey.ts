import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createSubmitSurveyHandler } from "./sessions/submit-survey.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/survey",
  method: "POST",
};
