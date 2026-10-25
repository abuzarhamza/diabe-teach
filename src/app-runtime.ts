import { OpenApiHttpApp } from "./adapters/inbound/http/create-app.js";
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

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  public static loadEnvConfig(
    env: NodeJS.ProcessEnv = process.env,
  ): RuntimeEnvConfig {
    const rawMongoUri = env.MONGODB_URI?.trim();
    const rawDbName = env.MONGODB_DB_NAME?.trim();
    const rawTokenSecret = env.CAPABILITY_TOKEN_SECRET?.trim();
    const rawApiKey = env.API_KEY?.trim();

    return {
      mongoUri: rawMongoUri && rawMongoUri.length > 0 ? rawMongoUri : undefined,
      mongoDbName:
        rawDbName && rawDbName.length > 0 ? rawDbName : DEFAULT_MONGODB_DB_NAME,
      capabilityTokenSecret:
        rawTokenSecret && rawTokenSecret.length > 0
          ? rawTokenSecret
          : undefined,
      apiKey: rawApiKey && rawApiKey.length > 0 ? rawApiKey : undefined,
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
