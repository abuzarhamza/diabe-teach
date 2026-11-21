import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AppRuntime } from "../src/app-runtime.js";
import { InMemoryLogSink } from "./support/in-memory-log-sink.js";

const yamlDir = mkdtempSync(join(tmpdir(), "diabe-teach-logging-"));

function yamlFile(name: string, content: string): string {
  const path = join(yamlDir, name);
  writeFileSync(path, content);
  return path;
}

const YAML_WARN_NOT_PRETTY = yamlFile("logging.yaml", "logging:\n  level: \"warn\"\n  pretty: false\n");

afterAll(() => {
  rmSync(yamlDir, { recursive: true, force: true });
});

describe("appRuntime.loadEnvConfig logging settings (structured-logging ticket 01)", () => {
  it("defaults to info, not pretty, when deployed", () => {
    const config = AppRuntime.loadEnvConfig({}, { yamlFilePath: false });
    expect(config.logLevel).toBe("info");
    expect(config.logPretty).toBe(false);
    expect(config.invalidLogLevel).toBeUndefined();
  });

  it("defaults to debug and pretty under netlify dev", () => {
    const config = AppRuntime.loadEnvConfig({ NETLIFY_DEV: "true" }, { yamlFilePath: false });
    expect(config.logLevel).toBe("debug");
    expect(config.logPretty).toBe(true);
  });

  it("takes logging.level and logging.pretty from YAML over the defaults", () => {
    const config = AppRuntime.loadEnvConfig({ NETLIFY_DEV: "true" }, { yamlFilePath: YAML_WARN_NOT_PRETTY });
    expect(config.logLevel).toBe("warn");
    expect(config.logPretty).toBe(false);
  });

  it("lets LOG_LEVEL and LOG_PRETTY win over YAML", () => {
    const config = AppRuntime.loadEnvConfig(
      { NETLIFY_DEV: "true", LOG_LEVEL: "error", LOG_PRETTY: "true" },
      { yamlFilePath: YAML_WARN_NOT_PRETTY },
    );
    expect(config.logLevel).toBe("error");
    expect(config.logPretty).toBe(true);
  });

  it("accepts every level, case and surrounding spaces ignored", () => {
    for (const level of [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "silent",
    ]) {
      expect(AppRuntime.loadEnvConfig({ LOG_LEVEL: ` ${level.toUpperCase()} ` }, { yamlFilePath: false }).logLevel).toBe(level);
    }
  });

  it("falls back to info for an invalid LOG_LEVEL, even under netlify dev, and reports it", () => {
    const config = AppRuntime.loadEnvConfig({ LOG_LEVEL: "verbose", NETLIFY_DEV: "true" }, { yamlFilePath: false });
    expect(config.logLevel).toBe("info");
    expect(config.invalidLogLevel).toBe("verbose");
  });

  it("falls back to info for an invalid logging.level in YAML", () => {
    const path = yamlFile("bad-level.yaml", "logging:\n  level: \"loud\"\n");
    const config = AppRuntime.loadEnvConfig({}, { yamlFilePath: path });
    expect(config.logLevel).toBe("info");
    expect(config.invalidLogLevel).toBe("loud");
  });

  it("ignores LOG_PRETTY and logging.pretty outside netlify dev", () => {
    const prettyYaml = yamlFile("pretty.yaml", "logging:\n  pretty: true\n");
    expect(AppRuntime.loadEnvConfig({ LOG_PRETTY: "true" }, { yamlFilePath: false }).logPretty).toBe(false);
    expect(AppRuntime.loadEnvConfig({}, { yamlFilePath: prettyYaml }).logPretty).toBe(false);
    expect(AppRuntime.loadEnvConfig({ NETLIFY_DEV: "false", LOG_PRETTY: "true" }, { yamlFilePath: false }).logPretty).toBe(false);
  });

  it("turns pretty off under netlify dev with LOG_PRETTY=false", () => {
    expect(AppRuntime.loadEnvConfig({ NETLIFY_DEV: "true", LOG_PRETTY: "false" }, { yamlFilePath: false }).logPretty).toBe(false);
  });
});

describe("appRuntime.buildLogger (structured-logging ticket 01)", () => {
  it("writes exactly one warn line naming an invalid LOG_LEVEL, then logs at info", () => {
    const sink = new InMemoryLogSink();
    const config = AppRuntime.loadEnvConfig({ LOG_LEVEL: "verbose" }, { yamlFilePath: false });
    const logger = AppRuntime.buildLogger(config, { destination: sink });

    logger.debug({}, "dropped");
    logger.info({}, "kept");

    const lines = sink.lines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ level: "warn", invalidLogLevel: "verbose", logLevel: "info" });
    expect(String(lines[0]?.msg)).toContain("LOG_LEVEL");
    expect(lines[1]).toMatchObject({ level: "info", msg: "kept" });
  });

  it("writes nothing for a valid level until something logs", () => {
    const sink = new InMemoryLogSink();
    AppRuntime.buildLogger(AppRuntime.loadEnvConfig({ LOG_LEVEL: "debug" }, { yamlFilePath: false }), { destination: sink });
    expect(sink.raw).toBe("");
  });

  it("writes JSON when not under netlify dev, even with LOG_PRETTY=true", () => {
    const sink = new InMemoryLogSink();
    const logger = AppRuntime.buildLogger(
      AppRuntime.loadEnvConfig({ LOG_PRETTY: "true" }, { yamlFilePath: false }),
      { destination: sink },
    );
    logger.info({}, "json");
    expect(sink.lines()[0]).toMatchObject({ msg: "json", service: "diabe-teach-api" });
  });

  it("writes non-JSON output under netlify dev by default", () => {
    const sink = new InMemoryLogSink();
    const logger = AppRuntime.buildLogger(
      AppRuntime.loadEnvConfig({ NETLIFY_DEV: "true" }, { yamlFilePath: false }),
      { destination: sink },
    );
    logger.info({}, "readable");
    expect(sink.raw).toContain("readable");
    expect(() => JSON.parse(sink.raw.trim())).toThrow();
  });

  it("provides the logger in the production dependencies", () => {
    const deps = AppRuntime.buildProductionDependencies({ LOG_LEVEL: "silent" });
    expect(deps.logger).toBeDefined();
    expect(typeof deps.logger?.child).toBe("function");
  });

  it("vitest setup defaults process.env.LOG_LEVEL to silent unless already set (ticket 05)", () => {
    expect(process.env.LOG_LEVEL).toBe("silent");
    expect(AppRuntime.loadEnvConfig().logLevel).toBe("silent");
  });
});
