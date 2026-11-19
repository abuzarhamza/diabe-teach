import type { Config } from "@netlify/functions";

export { createSignInHandler, default, lambdaHandler } from "./accounts/sign-in.js";

export const config: Config = {
  path: "/api/v1/accounts/sign-in",
  method: "POST",
};
