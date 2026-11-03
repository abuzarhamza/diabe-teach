import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createValidatePackHandler } from "./packs/validate-pack.js";

export const config: Config = {
  path: "/api/v1/packs/validate",
  method: "POST",
};
