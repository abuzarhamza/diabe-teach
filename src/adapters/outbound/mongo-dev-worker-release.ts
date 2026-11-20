import { isMainThread } from "node:worker_threads";
import { MongoConnectionManager } from "./mongo-client-singleton.js";

/**
 * Under `netlify dev`, each invocation of a v2 function runs in a new worker
 * thread that netlify-cli never terminates: the thread exits only once its
 * event loop is empty. A cached Mongo pool keeps it alive, so without this
 * every request leaked a thread and its Mongo connections until the dev
 * server stalled. A deployed function reuses its process between invocations
 * and keeps the cached connection.
 */
export class MongoDevWorkerRelease {
  /** Closes the cached Mongo connections when running in a `netlify dev` worker thread. */
  public static async afterInvocation(
    env: NodeJS.ProcessEnv = process.env,
    mainThread: boolean = isMainThread,
  ): Promise<void> {
    if (env.NETLIFY_DEV === "true" && !mainThread) {
      await MongoConnectionManager.closeAll();
    }
  }
}
