import { OpenApiHttpApp } from "./adapters/inbound/http/create-app.js";
import { EnvYamlConfigLoader } from "./adapters/outbound/env-yaml-config-loader.js";
import { HmacCapabilityTokenAdapter } from "./adapters/outbound/hmac-capability-token-adapter.js";
import {
  DEFAULT_MONGODB_DB_NAME,
  MongoCurriculumPackRepository,
} from "./adapters/outbound/mongo-curriculum-pack-repository.js";
import {
  ProductionDependencies,
  RuntimeEnvConfig,
  ServerlessHttpHandler,
  ServerlessRequestContext,
  ServerlessRouteConfig,
} from "./app-runtime.types.js";

export interface LoadEnvConfigOptions {
  readonly yamlFilePath?: string | false;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  public static loadEnvConfig(
    env: NodeJS.ProcessEnv = process.env,
    options?: LoadEnvConfigOptions,
  ): RuntimeEnvConfig {
    const yamlConfig =
      options?.yamlFilePath === false
        ? {}
        : EnvYamlConfigLoader.loadFromFile(
            options?.yamlFilePath ?? ".env.dev.yaml",
          );
    const resolvedYaml = EnvYamlConfigLoader.toRuntimeEnvConfig(yamlConfig);

    const rawMongoUri = env.MONGODB_URI?.trim();
    const rawDbName = env.MONGODB_DB_NAME?.trim();
    const rawTokenSecret = env.CAPABILITY_TOKEN_SECRET?.trim();
    const rawApiKey = env.API_KEY?.trim();

    return {
      mongoUri:
        rawMongoUri && rawMongoUri.length > 0
          ? rawMongoUri
          : resolvedYaml.mongoUri,
      mongoDbName:
        rawDbName && rawDbName.length > 0
          ? rawDbName
          : (resolvedYaml.mongoDbName ?? DEFAULT_MONGODB_DB_NAME),
      capabilityTokenSecret:
        rawTokenSecret && rawTokenSecret.length > 0
          ? rawTokenSecret
          : resolvedYaml.capabilityTokenSecret,
      apiKey:
        rawApiKey && rawApiKey.length > 0 ? rawApiKey : resolvedYaml.apiKey,
    };
  }

  public static buildProductionDependencies(
    env: NodeJS.ProcessEnv = process.env,
  ): ProductionDependencies {
    const config = AppRuntime.loadEnvConfig(env);

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config),
      tokenVerifier: HmacCapabilityTokenAdapter.fromSecret(
        config.capabilityTokenSecret,
      ),
      apiKey: config.apiKey,
      requireApiKey: Boolean(config.apiKey),
    };
  }

  public static getProductionDependencies(): ProductionDependencies {
    if (!AppRuntime.#cachedProductionDependencies) {
      AppRuntime.#cachedProductionDependencies =
        AppRuntime.buildProductionDependencies();
    }
    return AppRuntime.#cachedProductionDependencies;
  }

  public static setProductionDependencies(
    deps: ProductionDependencies | null,
  ): void {
    AppRuntime.#cachedProductionDependencies = deps;
  }

  public static createServerlessHttpHandler(
    customDeps?: ProductionDependencies,
  ): ServerlessHttpHandler {
    const fixedApp = customDeps ? new OpenApiHttpApp(customDeps) : null;

    return async (
      request: Request,
      context?: ServerlessRequestContext,
    ): Promise<Response> => {
      const app =
        fixedApp ?? new OpenApiHttpApp(AppRuntime.getProductionDependencies());
      return app.fetch(request, {
        params: context?.params,
      });
    };
  }

  public static defineServerlessRouteConfig(
    route: ServerlessRouteConfig,
  ): ServerlessRouteConfig {
    return {
      path: route.path,
      method: route.method,
    };
  }
}
