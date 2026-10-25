import { createApp } from "../adapters/inbound/http/create-app.js";
import { HmacCapabilityTokenAdapter } from "../adapters/outbound/hmac-capability-token-adapter.js";
import {
  DEFAULT_MONGODB_DB_NAME,
  MongoCurriculumPackRepository,
} from "../adapters/outbound/mongo-curriculum-pack-repository.js";
import {
  ProductionDependencies,
  RuntimeEnvConfig,
  ServerlessHttpHandler,
  ServerlessRequestContext,
  ServerlessRouteConfig,
} from "./runtime.types.js";

let cachedProductionDependencies: ProductionDependencies | null = null;

export function loadRuntimeEnvConfig(
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
      rawTokenSecret && rawTokenSecret.length > 0 ? rawTokenSecret : undefined,
    apiKey: rawApiKey && rawApiKey.length > 0 ? rawApiKey : undefined,
  };
}

export function buildProductionDependencies(
  env: NodeJS.ProcessEnv = process.env,
): ProductionDependencies {
  const runtimeConfig = loadRuntimeEnvConfig(env);

  const packRepo = MongoCurriculumPackRepository.fromConfig(() => {
    const currentConfig = loadRuntimeEnvConfig(env);
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

export function getProductionDependencies(): ProductionDependencies {
  if (!cachedProductionDependencies) {
    cachedProductionDependencies = buildProductionDependencies();
  }
  return cachedProductionDependencies;
}

export function createServerlessHttpHandler(
  deps: ProductionDependencies = getProductionDependencies(),
): ServerlessHttpHandler {
  const app = createApp(deps);

  return async function serverlessHttpHandler(
    request: Request,
    context?: ServerlessRequestContext,
  ): Promise<Response> {
    return app.fetch(request, {
      params: context?.params,
    });
  };
}

export function defineServerlessRouteConfig(
  route: ServerlessRouteConfig,
): ServerlessRouteConfig {
  return {
    path: route.path,
    method: route.method,
  };
}
