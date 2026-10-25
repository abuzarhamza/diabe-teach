import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { getMongoDatabase } from "../../src/adapters/outbound/mongo-client-singleton.js";
import { MongoCurriculumPackRepository } from "../../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { CurriculumPackDocument } from "../../src/adapters/outbound/mongo-curriculum-pack-repository.types.js";
import {
  NetlifyEndpointRouteConfig,
  NetlifyFunctionConfig,
  NetlifyProductionDependencies,
  NetlifyRuntimeEnvConfig,
} from "./netlify-runtime.types.js";

const DEFAULT_MONGODB_DB_NAME = "diabe_teach";
const CURRICULUM_PACKS_COLLECTION = "curriculum_packs";

let cachedProductionDependencies: NetlifyProductionDependencies | null = null;

export function loadNetlifyRuntimeEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): NetlifyRuntimeEnvConfig {
  const rawMongoUri = env.MONGODB_URI?.trim();
  const rawDbName = env.MONGODB_DB_NAME?.trim();
  const rawTokenSecret = env.CAPABILITY_TOKEN_SECRET?.trim();

  return {
    mongoUri: rawMongoUri && rawMongoUri.length > 0 ? rawMongoUri : undefined,
    mongoDbName:
      rawDbName && rawDbName.length > 0 ? rawDbName : DEFAULT_MONGODB_DB_NAME,
    capabilityTokenSecret:
      rawTokenSecret && rawTokenSecret.length > 0 ? rawTokenSecret : undefined,
  };
}

export function buildNetlifyProductionDependencies(
  env: NodeJS.ProcessEnv = process.env,
): NetlifyProductionDependencies {
  const runtimeConfig = loadNetlifyRuntimeEnvConfig(env);

  const packRepo = new MongoCurriculumPackRepository({
    getCollection: async () => {
      const currentConfig = loadNetlifyRuntimeEnvConfig(env);
      if (!currentConfig.mongoUri) {
        throw new Error(
          "MONGODB_URI environment variable is required to query custom Curriculum Packs.",
        );
      }
      const db = await getMongoDatabase(
        currentConfig.mongoUri,
        currentConfig.mongoDbName,
      );
      return db.collection<CurriculumPackDocument>(CURRICULUM_PACKS_COLLECTION);
    },
  });

  const tokenVerifier = runtimeConfig.capabilityTokenSecret
    ? new HmacCapabilityTokenAdapter(runtimeConfig.capabilityTokenSecret)
    : undefined;

  return {
    packRepo,
    tokenVerifier,
  };
}

export function getNetlifyProductionDependencies(): NetlifyProductionDependencies {
  if (!cachedProductionDependencies) {
    cachedProductionDependencies = buildNetlifyProductionDependencies();
  }
  return cachedProductionDependencies;
}

export function defineNetlifyRouteConfig(
  route: NetlifyEndpointRouteConfig,
): NetlifyFunctionConfig {
  return {
    path: route.path,
    method: route.method,
  };
}
