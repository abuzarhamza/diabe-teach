import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createArchivePackHandler } from "./packs/archive-pack.js";

export const config: Config = {
  path: "/api/v1/packs/:packId/archive",
  method: "POST",
};
