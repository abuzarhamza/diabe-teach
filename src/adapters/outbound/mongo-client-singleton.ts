import type { Connection } from "mongoose";
import type { LoggerPort } from "../../application/ports/logger.port.js";
import mongoose from "mongoose";
import { SilentLogger } from "../../application/services/silent-logger.js";

/**
 * Caches one mongoose connection per URI and database. Connection lifecycle
 * lines (opened, reused, closed) go to `logger` at `debug` and name the
 * database only, never the URI.
 */
export class MongoConnectionManager {
  static readonly #cachedConnections = new Map<string, Promise<Connection>>();

  public static async getConnection(
    uri: string,
    dbName = "diabe_teach",
    logger: LoggerPort = new SilentLogger(),
  ): Promise<Connection> {
    const cacheKey = `${uri}::${dbName}`;
    let connPromise = MongoConnectionManager.#cachedConnections.get(cacheKey);
    if (connPromise) {
      logger.debug({ dbName }, "mongo connection reused");
    }
    else {
      const connection = mongoose.createConnection(uri, {
        dbName,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });
      connPromise = connection.asPromise().then((opened) => {
        logger.debug({ dbName }, "mongo connection opened");
        return opened;
      }, (err: unknown) => {
        MongoConnectionManager.#cachedConnections.delete(cacheKey);
        throw err;
      });
      MongoConnectionManager.#cachedConnections.set(cacheKey, connPromise);
    }
    return connPromise;
  }

  /**
   * Closes every cached connection and forgets it; the next `getConnection`
   * opens a fresh one. A connection that never opened is skipped.
   */
  public static async closeAll(logger: LoggerPort = new SilentLogger()): Promise<void> {
    const pending = [
      ...MongoConnectionManager.#cachedConnections.values(),
    ];
    MongoConnectionManager.#cachedConnections.clear();
    await Promise.all(pending.map(async (connPromise) => {
      try {
        const connection = await connPromise;
        await connection.close();
        logger.debug({ dbName: connection.name }, "mongo connection closed");
      }
      catch {
        // It failed to open, so there is nothing to close.
      }
    }));
  }
}
