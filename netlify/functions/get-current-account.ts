import type { Config } from "@netlify/functions";

export { createGetCurrentAccountHandler, default, lambdaHandler } from "./accounts/get-current-account.js";

export const config: Config = {
  path: "/api/v1/accounts/me",
  method: "GET",
};
