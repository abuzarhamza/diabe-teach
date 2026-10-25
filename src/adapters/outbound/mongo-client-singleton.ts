import { Db, MongoClient } from "mongodb";

export class MongoConnectionManager {
  static readonly #cachedClientsByUri = new Map<string, Promise<MongoClient>>();

  public static async getDatabase(
    uri: string,
    dbName = "diabe_teach",
  ): Promise<Db> {
    let clientPromise = MongoConnectionManager.#cachedClientsByUri.get(uri);
    if (!clientPromise) {
      const client = new MongoClient(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      });
      clientPromise = client.connect().catch((err: unknown) => {
        MongoConnectionManager.#cachedClientsByUri.delete(uri);
        throw err;
      });
      MongoConnectionManager.#cachedClientsByUri.set(uri, clientPromise);
    }
    const connectedClient = await clientPromise;
    return connectedClient.db(dbName);
  }
}
