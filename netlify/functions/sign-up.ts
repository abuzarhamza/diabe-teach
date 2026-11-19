import type { Config } from "@netlify/functions";

export { createSignUpHandler, default, lambdaHandler } from "./accounts/sign-up.js";

export const config: Config = {
  path: "/api/v1/accounts/sign-up",
  method: "POST",
};
