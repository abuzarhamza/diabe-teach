import type { Config, Context } from "@netlify/functions";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/driven/hmac-capability-token-adapter.js";
import { getMongoDatabase } from "../../src/adapters/driven/mongo-client-singleton.js";
import { MongoCurriculumPackRepository } from "../../src/adapters/driven/mongo-curriculum-pack-repository.js";
import { CurriculumPackDocument } from "../../src/adapters/driven/mongo-curriculum-pack-repository.types.js";
import { createGetPackByIdHandler } from "../../src/adapters/driving/http/get-pack-by-id.handler.js";

function buildProductionGetPackByIdHandler() {
  const mongoDbName = process.env.MONGODB_DB_NAME ?? "diabe_teach";
  const tokenSecret = process.env.CAPABILITY_TOKEN_SECRET;

  const packRepo = new MongoCurriculumPackRepository({
    getCollection: async () => {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error(
          "MONGODB_URI environment variable is required to query custom Curriculum Packs.",
        );
      }
      const db = await getMongoDatabase(mongoUri, mongoDbName);
      return db.collection<CurriculumPackDocument>("curriculum_packs");
    },
  });

  const tokenVerifier =
    tokenSecret && tokenSecret.trim().length > 0
      ? new HmacCapabilityTokenAdapter(tokenSecret)
      : undefined;

  return createGetPackByIdHandler({
    packRepo,
    tokenVerifier,
  });
}

const getPackByIdHandler = buildProductionGetPackByIdHandler();

export default async function handler(
  request: Request,
  context: Context,
): Promise<Response> {
  return getPackByIdHandler(request, {
    params: context?.params,
  });
}

export const config: Config = {
  path: "/api/v1/packs/:packId",
  method: "GET",
};
