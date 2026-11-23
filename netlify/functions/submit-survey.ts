import type { Config } from "@netlify/functions";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { lambdaHandler } from "./sessions/submit-survey.js";

export { createSubmitSurveyHandler, lambdaHandler } from "./sessions/submit-survey.js";

export const config: Config = {
  path: "/api/v1/sessions/:sessionId/survey",
  method: "POST",
};

// Route parameters come from matching the request URL against `config.path` (api-hardening 03).
export default wrapLambdaHandler(lambdaHandler, config);
