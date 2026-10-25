import { Db, MongoClient } from "mongodb";

const cachedClientsByUri = new Map<string, Promise<MongoClient>>();

export async function getMongoDatabase(
  uri: string,
  dbName = "diabe_teach",
): Promise<Db> {
  let clientPromise = cachedClientsByUri.get(uri);
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    clientPromise = client.connect().catch((err: unknown) => {
      cachedClientsByUri.delete(uri);
      throw err;
    });
    cachedClientsByUri.set(uri, clientPromise);
  }
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}
