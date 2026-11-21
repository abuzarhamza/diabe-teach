import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import type { RequestLogFields } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArchivePackHandler } from "../../netlify/functions/packs/archive-pack.js";
import { wrapLambdaHandler } from "../../src/adapters/inbound/http/lambda-to-v2-wrapper.js";
import { createApiHandler } from "../../src/adapters/inbound/http/middy/api-handler.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { PinoLogger } from "../../src/adapters/outbound/pino-logger.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";
import { SignedInTeachers } from "./support/signed-in-teacher.js";

const ARCHIVE_PATH = "/api/v1/packs/:packId/archive";

type LambdaHandler = (event: APIGatewayProxyEvent, context: LambdaContext) => Promise<APIGatewayProxyResult>;

function netlifyContext(requestId: string): Context {
  return { params: {}, requestId, ip: "127.0.0.1" } as unknown as Context;
}

function sinkLogger() {
  const sink = new InMemoryLogSink();
  return {
    sink,
    logger: PinoLogger.create({ level: "info", destination: sink }),
  };
}

function summaryLines(sink: InMemoryLogSink) {
  return sink.lines().filter(line => line.msg === "request completed");
}

describe("request completed summary line (structured-logging ticket 02)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a 200 request writes one summary line with requestId, route, method, status and durationMs", async () => {
    const { sink, logger } = sinkLogger();
    const handler = wrapLambdaHandler(async () => ({ statusCode: 200, body: "{}" }), { path: ARCHIVE_PATH }, { logger });

    const response = await handler(
      new Request("http://localhost:8888/api/v1/packs/p-1/archive", { method: "POST" }),
      netlifyContext("req-200"),
    );

    expect(response.status).toBe(200);
    const lines = summaryLines(sink);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "info",
      requestId: "req-200",
      route: ARCHIVE_PATH,
      method: "POST",
      status: 200,
    });
    expect(typeof lines[0]!.durationMs).toBe("number");
    expect(lines[0]).not.toHaveProperty("errorCode");
  });

  it("hands the handler a child logger carrying the request id", async () => {
    const { sink, logger } = sinkLogger();
    const handler = wrapLambdaHandler(async (event) => {
      (event as APIGatewayProxyEvent & RequestLogFields).logger.info({ packId: "p-1" }, "inside handler");
      return { statusCode: 200, body: "{}" };
    }, { path: ARCHIVE_PATH }, { logger });

    await handler(new Request("http://localhost:8888/api/v1/packs/p-1/archive", { method: "POST" }), netlifyContext("req-child"));

    const inside = sink.lines().find(line => line.msg === "inside handler");
    expect(inside).toMatchObject({
      requestId: "req-child",
      route: ARCHIVE_PATH,
      method: "POST",
      packId: "p-1",
    });
  });

  it("each netlify dev .html retry is logged as its own invocation", async () => {
    const { sink, logger } = sinkLogger();
    const handler = wrapLambdaHandler(async () => ({ statusCode: 404, body: "{}" }), { path: ARCHIVE_PATH }, { logger });

    await handler(new Request("http://localhost:8888/api/v1/packs/p-1/archive", { method: "POST" }), netlifyContext("req-a"));
    await handler(new Request("http://localhost:8888/api/v1/packs/p-1/archive.html", { method: "POST" }), netlifyContext("req-b"));

    expect(summaryLines(sink).map(line => line.requestId)).toEqual(["req-a", "req-b"]);
  });

  it("a domain refusal (403 PACK_IS_SYSTEM_PACK) logs errorCode at info", async () => {
    const { sink, logger } = sinkLogger();
    const teachers = new SignedInTeachers();
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const archive = createArchivePackHandler({
      packRepo,
      accountTokenVerifier: teachers.verifier,
      apiKey: undefined,
      requireApiKey: false,
    }) as unknown as LambdaHandler;
    const handler = wrapLambdaHandler(archive, { path: ARCHIVE_PATH }, { logger });

    const response = await handler(
      new Request(`http://localhost:8888/api/v1/packs/${DIABE_TEACH_PACK.id}/archive`, {
        method: "POST",
        headers: { authorization: `Bearer ${await teachers.tokenFor()}` },
      }),
      netlifyContext("req-403"),
    );

    expect(response.status).toBe(403);
    const lines = summaryLines(sink);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "info",
      requestId: "req-403",
      status: 403,
      errorCode: "PACK_IS_SYSTEM_PACK",
    });
  });

  it("an unexpected error's summary line is at error with status 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sink, logger } = sinkLogger();
    const failing = createApiHandler(async () => {
      throw new Error("database exploded");
    }, {}, "getGameSessionState") as unknown as LambdaHandler;
    const handler = wrapLambdaHandler(failing, { path: "/api/v1/sessions/:sessionId" }, { logger });

    const response = await handler(new Request("http://localhost:8888/api/v1/sessions/s-1"), netlifyContext("req-500"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    const lines = summaryLines(sink);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "error",
      requestId: "req-500",
      method: "GET",
      status: 500,
    });
    expect(lines[0]).not.toHaveProperty("errorCode");
  });
});
