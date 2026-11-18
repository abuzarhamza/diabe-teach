import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

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
 * Supports ${VAR_NAME} syntax.
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] ?? "";
  });
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

  // Resolve environment variables in the config
  const resolvedEnv: EnvironmentConfig = {
    base_url: resolveEnvVars(envConfig.base_url),
    api_key: resolveEnvVars(envConfig.api_key),
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
