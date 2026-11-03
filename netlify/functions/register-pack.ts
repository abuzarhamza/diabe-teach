import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createRegisterPackHandler } from "./packs/register-pack.js";

export const config: Config = {
  path: "/api/v1/packs",
  method: "POST",
};
