import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createUnarchivePackHandler } from "./packs/unarchive-pack.js";

export const config: Config = {
  path: "/api/v1/packs/:packId/unarchive",
  method: "POST",
};
