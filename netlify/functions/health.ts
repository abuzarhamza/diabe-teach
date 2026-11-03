import type { Config } from "@netlify/functions";

export default async () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/health",
  method: "GET",
};
