import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePathParameters, wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";

const CHAINS_PATH = "/api/v1/sessions/:sessionId/rounds/:roundNumber/chains";
const ARCHIVE_PATH = "/api/v1/packs/:packId/archive";
const PACK_PATH = "/api/v1/packs/:packId";

function netlifyContext(params: Record<string, string>): Context {
  return { params, requestId: "req-1", ip: "127.0.0.1" } as unknown as Context;
}

/** Wraps an echo handler and returns the `pathParameters` the wrapper built. */
async function pathParametersFor(
  url: string,
  path: string,
  contextParams: Record<string, string>,
): Promise<APIGatewayProxyEvent["pathParameters"]> {
  const handler = wrapLambdaHandler(async (event) => {
    return {
      statusCode: 200,
      body: JSON.stringify(event.pathParameters),
    };
  }, { path });
  const response = await handler(new Request(url), netlifyContext(contextParams));
  return JSON.parse(await response.text());
}

describe("wrapLambdaHandler route parameters (api-hardening 03)", () => {
  it("reads parameters from the URL and config.path when context.params is empty", async () => {
    const params = await pathParametersFor(
      "http://localhost:8888/api/v1/sessions/s-1/rounds/2/chains",
      CHAINS_PATH,
      {},
    );
    expect(params).toEqual({ sessionId: "s-1", roundNumber: "2" });
  });

  it("agrees with context.params on a plain request", async () => {
    const params = await pathParametersFor(
      "http://localhost:8888/api/v1/packs/my-pack/archive",
      ARCHIVE_PATH,
      { packId: "my-pack" },
    );
    expect(params).toEqual({ packId: "my-pack" });
  });

  it("decodes encoded parameter values", async () => {
    const params = await pathParametersFor("http://localhost:8888/api/v1/packs/a%20b", PACK_PATH, {});
    expect(params).toEqual({ packId: "a b" });
  });

  it.each([
    "/api/v1/packs/diabe-teach/archive.html",
    "/api/v1/packs/diabe-teach/archive.htm",
    "/api/v1/packs/diabe-teach/archive/index.html",
    "/api/v1/packs/diabe-teach/archive/index.htm",
  ])("a netlify dev retry %s keeps the original parameters", async (path) => {
    const params = await pathParametersFor(`http://localhost:8888${path}`, ARCHIVE_PATH, {});
    expect(params).toEqual({ packId: "diabe-teach" });
  });

  it("a .html retry on a trailing parameter is not read as part of the id", async () => {
    // netlify dev passes `{ packId: "nope.html" }` in context.params on this retry.
    const params = await pathParametersFor(
      "http://localhost:8888/api/v1/packs/nope.html",
      PACK_PATH,
      { packId: "nope.html" },
    );
    expect(params).toEqual({ packId: "nope" });
  });

  it("a .html retry of a two-parameter route keeps both parameters", async () => {
    const params = await pathParametersFor(
      "http://localhost:8888/api/v1/sessions/s-1/rounds/1/standings.html",
      "/api/v1/sessions/:sessionId/rounds/:roundNumber/standings",
      {},
    );
    expect(params).toEqual({ sessionId: "s-1", roundNumber: "1" });
  });

  it("falls back to context.params when no declared path matches", () => {
    expect(resolvePathParameters("/elsewhere", { path: PACK_PATH }, { packId: "x" })).toEqual({ packId: "x" });
    expect(resolvePathParameters("/elsewhere", { path: PACK_PATH }, {})).toBeNull();
  });

  it("returns no parameters for a route without any", () => {
    expect(resolvePathParameters("/api/v1/packs", { path: "/api/v1/packs" }, {})).toEqual({});
  });
});

describe("every wrapped route passes its own config to the wrapper", () => {
  const functionsDir = join(import.meta.dirname, "../../netlify/functions");
  const routeFiles = readdirSync(functionsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
    .map(entry => entry.name);

  it.each(routeFiles.filter(name => name !== "health.ts"))("%s", (name) => {
    const source = readFileSync(join(functionsDir, name), "utf8");
    expect(source).toContain("export const config: Config = {");
    expect(source).toContain("export default wrapLambdaHandler(lambdaHandler, config, AppRuntime.invocationOptions);");
  });
});

describe("wrapLambdaHandler afterInvocation", () => {
  it("runs after the handler answers", async () => {
    const calls: string[] = [];
    const handler = wrapLambdaHandler(async () => {
      calls.push("handler");
      return { statusCode: 200, body: "{}" };
    }, { path: "/api/v1/packs" }, {
      afterInvocation: async () => {
        calls.push("after");
      },
    });
    const response = await handler(new Request("http://localhost/api/v1/packs"), netlifyContext({}));
    expect(response.status).toBe(200);
    expect(calls).toEqual(["handler", "after"]);
  });

  it("runs after the handler throws, and the error still propagates", async () => {
    let after = 0;
    const handler = wrapLambdaHandler(async () => {
      throw new Error("boom");
    }, { path: "/api/v1/packs" }, {
      afterInvocation: async () => {
        after += 1;
      },
    });
    await expect(handler(new Request("http://localhost/api/v1/packs"), netlifyContext({}))).rejects.toThrow("boom");
    expect(after).toBe(1);
  });
});
