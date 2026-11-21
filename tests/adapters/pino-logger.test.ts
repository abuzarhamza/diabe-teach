import type { LogLevel } from "../../src/application/ports/logger.port.js";
import { describe, expect, it } from "vitest";
import { PinoLogger } from "../../src/adapters/outbound/pino-logger.js";
import { SilentLogger } from "../../src/application/services/silent-logger.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";

const WRITE_METHODS = ["debug", "info", "warn", "error"] as const;

function writeOneOfEach(level: LogLevel): Array<Record<string, unknown>> {
  const sink = new InMemoryLogSink();
  const logger = PinoLogger.create({ level, destination: sink });
  for (const method of WRITE_METHODS) {
    logger[method]({}, `${method} line`);
  }
  return sink.lines();
}

describe("pinoLogger (structured-logging ticket 01)", () => {
  it.each([
    [
      "trace",
      ["debug", "info", "warn", "error"],
    ],
    [
      "debug",
      ["debug", "info", "warn", "error"],
    ],
    [
      "info",
      ["info", "warn", "error"],
    ],
    [
      "warn",
      ["warn", "error"],
    ],
    [
      "error",
      ["error"],
    ],
    ["fatal", []],
    ["silent", []],
  ] as const)("at level %s writes only %j", (level, expected) => {
    expect(writeOneOfEach(level).map(line => line.level)).toEqual(expected);
  });

  it("silent writes nothing at all", () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "silent", destination: sink });
    for (const method of WRITE_METHODS) {
      logger[method]({ sessionId: "s-1" }, "nothing");
    }
    logger.child({ requestId: "r-1" }).error({}, "still nothing");
    expect(sink.raw).toBe("");
  });

  it("writes one JSON object per line with the base fields and a label level, without pid or hostname", () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "info", destination: sink });

    logger.info({ sessionId: "s-1" }, "hello");

    expect(sink.raw.endsWith("\n")).toBe(true);
    const [line] = sink.lines();
    expect(line).toMatchObject({
      level: "info",
      service: "diabe-teach-api",
      sessionId: "s-1",
      msg: "hello",
    });
    expect(typeof line?.time).toBe("number");
    expect(line).not.toHaveProperty("pid");
    expect(line).not.toHaveProperty("hostname");
  });

  it("adds child() fields to every line the child writes, and nests children", () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "debug", destination: sink });
    const child = logger.child({ requestId: "req-1", route: "/api/v1/packs" });

    for (const method of WRITE_METHODS) {
      child[method]({}, method);
    }
    child.child({ method: "GET" }).info({}, "nested");
    logger.info({}, "parent");

    const lines = sink.lines();
    expect(lines).toHaveLength(6);
    for (const line of lines.slice(0, 5)) {
      expect(line).toMatchObject({ requestId: "req-1", route: "/api/v1/packs", service: "diabe-teach-api" });
    }
    expect(lines[4]).toMatchObject({ method: "GET", msg: "nested" });
    expect(lines[5]).not.toHaveProperty("requestId");
  });

  it("writes human-readable, non-JSON output in pretty mode", () => {
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "info", pretty: true, destination: sink });

    logger.info({ requestId: "req-1" }, "pretty hello");

    expect(sink.raw).toContain("pretty hello");
    expect(sink.raw).toContain("req-1");
    expect(() => JSON.parse(sink.raw.trim().split("\n")[0] ?? "")).toThrow();
  });

  it("knows the valid levels", () => {
    expect([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "silent",
    ].every(PinoLogger.isLogLevel)).toBe(true);
    expect(PinoLogger.isLogLevel("verbose")).toBe(false);
  });
});

describe("silentLogger", () => {
  it("accepts every call, and child() returns a silent logger", () => {
    const logger = new SilentLogger();
    for (const method of WRITE_METHODS) {
      expect(() => logger[method]({ a: 1 }, "x")).not.toThrow();
    }
    expect(logger.child({ requestId: "r" })).toBeInstanceOf(SilentLogger);
  });
});
