import type { Config } from "@netlify/functions";
export { default, lambdaHandler, createGetPackByIdHandler } from "./packs/get-pack-by-id.js";

export const config: Config = {
  path: "/api/v1/packs/:packId",
  method: "GET",
};
