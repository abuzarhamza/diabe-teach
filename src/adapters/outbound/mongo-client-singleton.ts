import type { Connection } from "mongoose";
import mongoose from "mongoose";

export class MongoConnectionManager {
  static readonly #cachedConnections = new Map<string, Promise<Connection>>();

  public static async getConnection(
    uri: string,
    dbName = "diabe_teach",
  ): Promise<Connection> {
    const cacheKey = `${uri}::${dbName}`;
    let connPromise = MongoConnectionManager.#cachedConnections.get(cacheKey);
    if (!connPromise) {
      const connection = mongoose.createConnection(uri, {
        dbName,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      });
      connPromise = connection.asPromise().catch((err: unknown) => {
        MongoConnectionManager.#cachedConnections.delete(cacheKey);
        throw err;
      });
      MongoConnectionManager.#cachedConnections.set(cacheKey, connPromise);
    }
    return connPromise;
  }
}
