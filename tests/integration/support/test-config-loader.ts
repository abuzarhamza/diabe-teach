import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { EnvYamlConfigLoader } from "../../../src/adapters/outbound/env-yaml-config-loader.js";

export interface EnvironmentConfig {
  base_url: string;
  api_key: string;
  timeout_ms: number;
  use_mongodb: boolean;
}

export interface TestData {
  default_pack_id: string;
  default_instructor_name: string;
  default_participant_names: string[];
}

export interface TestConfig {
  environments: Record<string, EnvironmentConfig>;
  test_data: TestData;
}

export interface ResolvedTestConfig {
  env: EnvironmentConfig;
  testData: TestData;
  envName: string;
}

/**
 * Resolves environment variable references in strings.
 * Supports ${VAR_NAME} syntax. When a variable is unset or blank, the value in
 * `fallbacks` (if any) is used instead, then "".
 */
function resolveEnvVars(
  value: string,
  fallbacks: Readonly<Record<string, string | undefined>> = {},
): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    const fromEnv = process.env[varName]?.trim();
    if (fromEnv) {
      return fromEnv;
    }
    return fallbacks[varName]?.trim() ?? "";
  });
}

/**
 * Fallbacks for the `local` environment, read from the gitignored
 * `.env.dev.yaml` with the same loader `AppRuntime` uses, so `npm run test:bdd`
 * sends the same API key `npm run dev:local` enforces without any export.
 * Values are never logged.
 */
function localFallbacks(repoRoot: string): Record<string, string | undefined> {
  const yaml = EnvYamlConfigLoader.loadFromFile(join(repoRoot, ".env.dev.yaml"));
  return {
    API_KEY: EnvYamlConfigLoader.toRuntimeEnvConfig(yaml).apiKey,
  };
}

/**
 * Loads and resolves the test configuration for the current environment.
 * Environment is selected via BDD_ENV variable (default: "local").
 */
export function loadTestConfig(): ResolvedTestConfig {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = join(__dirname, "..", "test-config.yaml");

  const rawYaml = readFileSync(configPath, "utf-8");
  const config = parseYaml(rawYaml) as TestConfig;

  const envName = process.env.BDD_ENV ?? "local";
  const envConfig = config.environments[envName];

  if (!envConfig) {
    throw new Error(
      `Unknown BDD_ENV: "${envName}". Available: ${Object.keys(config.environments).join(", ")}`,
    );
  }

  // Resolve environment variables in the config. Only `local` falls back to
  // the developer's own .env.dev.yaml; remote environments need explicit vars.
  const fallbacks = envName === "local"
    ? localFallbacks(join(__dirname, "..", "..", ".."))
    : {};
  const resolvedEnv: EnvironmentConfig = {
    base_url: resolveEnvVars(envConfig.base_url, fallbacks),
    api_key: resolveEnvVars(envConfig.api_key, fallbacks),
    timeout_ms: envConfig.timeout_ms,
    use_mongodb: envConfig.use_mongodb,
  };

  return {
    env: resolvedEnv,
    testData: config.test_data,
    envName,
  };
}

// Singleton instance for convenience
/**
 * The Capability Token secret `npm run dev:local` signs with (the same
 * precedence as `AppRuntime`: the environment, then `.env.dev.yaml`), so a
 * scenario can hold a valid token for a session that does not exist. Local
 * environment only; the value is never logged.
 */
export function localCapabilityTokenSecret(): string | undefined {
  const fromEnv = process.env.CAPABILITY_TOKEN_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const yaml = EnvYamlConfigLoader.loadFromFile(join(repoRoot, ".env.dev.yaml"));
  return EnvYamlConfigLoader.toRuntimeEnvConfig(yaml).capabilityTokenSecret?.trim() || undefined;
}

let _cachedConfig: ResolvedTestConfig | null = null;

export function getTestConfig(): ResolvedTestConfig {
  if (!_cachedConfig) {
    _cachedConfig = loadTestConfig();
  }
  return _cachedConfig;
}

export function resetTestConfig(): void {
  _cachedConfig = null;
}
