import type { WrapLambdaHandlerOptions } from "./adapters/inbound/http/lambda-to-v2-wrapper.types.js";
import type {
  ProductionDependencies,
  RuntimeEnvConfig,
} from "./app-runtime.types.js";
import type { LoggerPort, LogLevel } from "./application/ports/logger.port.js";
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
import { PinoLogger } from "./adapters/outbound/pino-logger.js";
import { SeedrandomSeededRandom } from "./adapters/outbound/seedrandom-seeded-random.js";
import { SystemClock } from "./adapters/outbound/system-clock.js";

export interface LoadEnvConfigOptions {
  readonly yamlFilePath?: string | false;
}

export interface BuildLoggerOptions {
  /** Where lines go; stdout by default. Tests pass an in-memory stream. */
  readonly destination?: NodeJS.WritableStream;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  /**
   * Passed by every route to `wrapLambdaHandler`. Under `netlify dev`, the
   * Mongo connections are closed after each invocation so the worker thread
   * netlify-cli started for it can exit (see `MongoDevWorkerRelease`).
   * `logger` is read per invocation (a getter), so it is the production
   * logger currently cached, built on first use.
   */
  public static readonly invocationOptions: WrapLambdaHandlerOptions = {
    afterInvocation: async () => MongoDevWorkerRelease.afterInvocation(
      process.env,
      undefined,
      AppRuntime.getProductionDependencies().logger,
    ),
    get logger(): LoggerPort | undefined {
      return AppRuntime.getProductionDependencies().logger;
    },
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
      ...AppRuntime.#resolveLogLevel(env, resolvedYaml.logLevel),
      logPretty: AppRuntime.#resolveLogPretty(env, resolvedYaml.logPretty),
    };
  }

  /**
   * LOG_LEVEL wins over `logging.level`. Without either, `info`, or `debug`
   * under netlify dev. A value that isn't a level falls back to `info` and is
   * reported as `invalidLogLevel`, so a typo never crashes or silences logs.
   */
  static #resolveLogLevel(
    env: NodeJS.ProcessEnv,
    yamlLevel?: string,
  ): { logLevel: LogLevel; invalidLogLevel?: string } {
    const configured = AppRuntime.#trimOrFallback(env.LOG_LEVEL, yamlLevel?.trim());
    if (configured === undefined) {
      return {
        logLevel: env.NETLIFY_DEV === "true"
          ? "debug"
          : "info",
      };
    }
    const normalised = configured.toLowerCase();
    return PinoLogger.isLogLevel(normalised)
      ? { logLevel: normalised }
      : { logLevel: "info", invalidLogLevel: configured };
  }

  /**
   * Pretty output is on by default under netlify dev and can be turned off
   * with LOG_PRETTY=false (or `logging.pretty: false`). Outside netlify dev it
   * is always off, the same guard as DEV_DISABLE_API_KEY, so a copied
   * variable can't change a deployed function's log format.
   */
  static #resolveLogPretty(env: NodeJS.ProcessEnv, yamlPretty?: boolean): boolean {
    if (env.NETLIFY_DEV !== "true") {
      return false;
    }
    const fromEnv = env.LOG_PRETTY?.trim().toLowerCase();
    if (fromEnv === "true" || fromEnv === "false") {
      return fromEnv === "true";
    }
    return yamlPretty ?? true;
  }

  /**
   * Builds the logger for the resolved config, and writes the one warning for
   * an invalid LOG_LEVEL through it.
   */
  public static buildLogger(
    config: Pick<RuntimeEnvConfig, "logLevel" | "logPretty" | "invalidLogLevel">,
    options?: BuildLoggerOptions,
  ): LoggerPort {
    const logger = PinoLogger.create({
      level: config.logLevel,
      pretty: config.logPretty,
      destination: options?.destination,
    });
    if (config.invalidLogLevel !== undefined) {
      logger.warn(
        { invalidLogLevel: config.invalidLogLevel, logLevel: config.logLevel },
        "LOG_LEVEL is not a known level; using info",
      );
    }
    return logger;
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

    const logger = AppRuntime.buildLogger(config);

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config, logger),
      sessionRepo: MongoGameSessionRepository.fromConfig(config, logger),
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
      clock: new SystemClock(),
      seededRandom: new SeedrandomSeededRandom(),
      seedGenerator: new CryptoBoardSeedGenerator(),
      accountRepo: MongoInstructorAccountRepository.fromConfig(config, logger),
      passwordHasher: new Argon2PasswordHasher(),
      accountTokenSigner: accountTokenAdapter,
      accountTokenVerifier: accountTokenAdapter,
      idGenerator: new CryptoIdGenerator(),
      apiKey: config.apiKey,
      requireApiKey: Boolean(config.apiKey),
      logger,
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
