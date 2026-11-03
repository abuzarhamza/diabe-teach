import type {
  ProductionDependencies,
  RuntimeEnvConfig,
} from "./app-runtime.types.js";
import { EnvYamlConfigLoader } from "./adapters/outbound/env-yaml-config-loader.js";
import { FakeCapabilityTokenAdapter } from "./adapters/outbound/fake-capability-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "./adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryGameSessionRepository } from "./adapters/outbound/in-memory-game-session-repository.js";
import {
  DEFAULT_MONGODB_DB_NAME,
  MongoCurriculumPackRepository,
} from "./adapters/outbound/mongo-curriculum-pack-repository.js";

export interface LoadEnvConfigOptions {
  readonly yamlFilePath?: string | false;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  public static loadEnvConfig(
    env: NodeJS.ProcessEnv = process.env,
    options?: LoadEnvConfigOptions,
  ): RuntimeEnvConfig {
    const yamlConfig
      = options?.yamlFilePath === false
        ? {}
        : EnvYamlConfigLoader.loadFromFile(
            options?.yamlFilePath ?? ".env.dev.yaml",
          );
    const resolvedYaml = EnvYamlConfigLoader.toRuntimeEnvConfig(yamlConfig);

    return {
      mongoUri: AppRuntime.#trimOrFallback(
        env.MONGODB_URI,
        resolvedYaml.mongoUri,
      ),
      mongoDbName:
        AppRuntime.#trimOrFallback(
          env.MONGODB_DB_NAME,
          resolvedYaml.mongoDbName,
        ) ?? DEFAULT_MONGODB_DB_NAME,
      capabilityTokenSecret: AppRuntime.#trimOrFallback(
        env.CAPABILITY_TOKEN_SECRET,
        resolvedYaml.capabilityTokenSecret,
      ),
      apiKey: AppRuntime.#trimOrFallback(env.API_KEY, resolvedYaml.apiKey),
    };
  }

  static #trimOrFallback(
    value: string | undefined,
    fallback?: string,
  ): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0
      ? trimmed
      : fallback;
  }

  public static buildProductionDependencies(
    env: NodeJS.ProcessEnv = process.env,
  ): ProductionDependencies {
    const config = AppRuntime.loadEnvConfig(env);

    // HmacCapabilityTokenAdapter implements both signer and verifier ports
    // Falls back to FakeCapabilityTokenAdapter for local development without secrets
    const tokenAdapter = HmacCapabilityTokenAdapter.fromSecret(
      config.capabilityTokenSecret,
    ) ?? new FakeCapabilityTokenAdapter();

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config),
      sessionRepo: new InMemoryGameSessionRepository(),
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
      apiKey: config.apiKey,
      requireApiKey: Boolean(config.apiKey),
    };
  }

  public static getProductionDependencies(): ProductionDependencies {
    if (!AppRuntime.#cachedProductionDependencies) {
      AppRuntime.#cachedProductionDependencies
        = AppRuntime.buildProductionDependencies();
    }
    return AppRuntime.#cachedProductionDependencies;
  }

  public static setProductionDependencies(
    deps: ProductionDependencies | null,
  ): void {
    AppRuntime.#cachedProductionDependencies = deps;
  }
}
