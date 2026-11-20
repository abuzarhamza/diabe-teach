import type { WrapLambdaHandlerOptions } from "./adapters/inbound/http/lambda-to-v2-wrapper.types.js";
import type {
  ProductionDependencies,
  RuntimeEnvConfig,
} from "./app-runtime.types.js";
import { Argon2PasswordHasher } from "./adapters/outbound/argon2-password-hasher.js";
import { CryptoBoardSeedGenerator } from "./adapters/outbound/crypto-board-seed-generator.js";
import { CryptoIdGenerator } from "./adapters/outbound/crypto-id-generator.js";
import { EnvYamlConfigLoader } from "./adapters/outbound/env-yaml-config-loader.js";
import { FakeAccountTokenAdapter } from "./adapters/outbound/fake-account-token-adapter.js";
import { FakeCapabilityTokenAdapter } from "./adapters/outbound/fake-capability-token-adapter.js";
import { HmacAccountTokenAdapter } from "./adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "./adapters/outbound/hmac-capability-token-adapter.js";
import {
  DEFAULT_MONGODB_DB_NAME,
  MongoCurriculumPackRepository,
} from "./adapters/outbound/mongo-curriculum-pack-repository.js";
import { MongoDevWorkerRelease } from "./adapters/outbound/mongo-dev-worker-release.js";
import { MongoGameSessionRepository } from "./adapters/outbound/mongo-game-session-repository.js";
import { MongoInstructorAccountRepository } from "./adapters/outbound/mongo-instructor-account-repository.js";
import { SeedrandomSeededRandom } from "./adapters/outbound/seedrandom-seeded-random.js";
import { SystemClock } from "./adapters/outbound/system-clock.js";

export interface LoadEnvConfigOptions {
  readonly yamlFilePath?: string | false;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  /**
   * Passed by every route to `wrapLambdaHandler`. Under `netlify dev`, the
   * Mongo connections are closed after each invocation so the worker thread
   * netlify-cli started for it can exit (see `MongoDevWorkerRelease`).
   */
  public static readonly invocationOptions: WrapLambdaHandlerOptions = {
    afterInvocation: async () => MongoDevWorkerRelease.afterInvocation(),
  };

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
      accountTokenSecret: AppRuntime.#trimOrFallback(
        env.ACCOUNT_TOKEN_SECRET,
        resolvedYaml.accountTokenSecret,
      ),
      apiKey: AppRuntime.#apiKeyDisabledForDev(env)
        ? undefined
        : AppRuntime.#trimOrFallback(env.API_KEY, resolvedYaml.apiKey),
    };
  }

  /**
   * `npm run dev:prototype` turns the x-api-key check off so the Concept
   * Chain prototype pages never hold the key. Honoured only under
   * `netlify dev` (which sets NETLIFY_DEV=true), never in a deployed function.
   */
  static #apiKeyDisabledForDev(env: NodeJS.ProcessEnv): boolean {
    return env.DEV_DISABLE_API_KEY === "true" && env.NETLIFY_DEV === "true";
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

    // Account Tokens have their own secret. Without one (local development),
    // tokens live only in this process's memory, like the capability fallback.
    const accountTokenAdapter = HmacAccountTokenAdapter.fromSecret(
      config.accountTokenSecret,
    ) ?? new FakeAccountTokenAdapter();

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config),
      sessionRepo: MongoGameSessionRepository.fromConfig(config),
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
      clock: new SystemClock(),
      seededRandom: new SeedrandomSeededRandom(),
      seedGenerator: new CryptoBoardSeedGenerator(),
      accountRepo: MongoInstructorAccountRepository.fromConfig(config),
      passwordHasher: new Argon2PasswordHasher(),
      accountTokenSigner: accountTokenAdapter,
      accountTokenVerifier: accountTokenAdapter,
      idGenerator: new CryptoIdGenerator(),
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
