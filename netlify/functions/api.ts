import { HmacCapabilityTokenAdapter } from "../../src/adapters/driven/hmac-capability-token-adapter.js";
import { getMongoDatabase } from "../../src/adapters/driven/mongo-client-singleton.js";
import {
  CurriculumPackDocument,
  MongoCurriculumPackRepository,
} from "../../src/adapters/driven/mongo-curriculum-pack-repository.js";
import { createApp } from "../../src/adapters/driving/http/create-app.js";

const DEFAULT_DEV_TOKEN_SECRET =
  "diabe-teach-default-dev-capability-token-secret";

function buildProductionApp() {
  const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
  const mongoDbName = process.env.MONGODB_DB_NAME ?? "diabe_teach";
  const tokenSecret =
    process.env.CAPABILITY_TOKEN_SECRET ?? DEFAULT_DEV_TOKEN_SECRET;

  const packRepo = new MongoCurriculumPackRepository({
    getCollection: async () => {
      const db = await getMongoDatabase(mongoUri, mongoDbName);
      return db.collection<CurriculumPackDocument>("curriculum_packs");
    },
  });

  const tokenVerifier = new HmacCapabilityTokenAdapter(tokenSecret);

  return createApp({
    packRepo,
    tokenVerifier,
  });
}

const app = buildProductionApp();

export default async function handler(
  request: Request,
  _context: unknown,
): Promise<Response> {
  return app.fetch(request);
}

export const config = {
  path: "/api/v1/*",
};
