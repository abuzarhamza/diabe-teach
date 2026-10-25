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
    const runtimeConfig = AppRuntime.loadEnvConfig(env);

    const packRepo = MongoCurriculumPackRepository.fromConfig(() => {
      const currentConfig = AppRuntime.loadEnvConfig(env);
      return {
        mongoUri: currentConfig.mongoUri,
        mongoDbName: currentConfig.mongoDbName,
      };
    });

    const tokenVerifier = runtimeConfig.capabilityTokenSecret
      ? new HmacCapabilityTokenAdapter(runtimeConfig.capabilityTokenSecret)
      : undefined;

    return {
      packRepo,
      tokenVerifier,
      apiKey: runtimeConfig.apiKey,
      requireApiKey: runtimeConfig.apiKey !== undefined,
    };
  }

  public static getProductionDependencies(): ProductionDependencies {
    if (!AppRuntime.#cachedProductionDependencies) {
      AppRuntime.#cachedProductionDependencies =
        AppRuntime.buildProductionDependencies();
    }
    return AppRuntime.#cachedProductionDependencies;
  }

  public static createServerlessHttpHandler(
    deps: ProductionDependencies = AppRuntime.getProductionDependencies(),
  ): ServerlessHttpHandler {
    const app = new OpenApiHttpApp(deps);

    return async (
      request: Request,
      context?: ServerlessRequestContext,
    ): Promise<Response> => {
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
