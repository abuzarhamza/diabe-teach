import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createListPacksHandler } from "./packs/list-packs.js";

export const config: Config = {
  path: "/api/v1/packs",
  method: "GET",
};
