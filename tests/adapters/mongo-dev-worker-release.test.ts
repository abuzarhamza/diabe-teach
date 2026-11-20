import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoConnectionManager } from "../../src/adapters/outbound/mongo-client-singleton.js";
import { MongoDevWorkerRelease } from "../../src/adapters/outbound/mongo-dev-worker-release.js";

describe("mongoDevWorkerRelease.afterInvocation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the Mongo connections in a netlify dev worker thread", async () => {
    const closeAll = vi.spyOn(MongoConnectionManager, "closeAll").mockResolvedValue();
    await MongoDevWorkerRelease.afterInvocation({ NETLIFY_DEV: "true" }, false);
    expect(closeAll).toHaveBeenCalledOnce();
  });

  it.each([
    ["deployed function (no NETLIFY_DEV)", {}, false],
    [
      "netlify dev, main thread",
      { NETLIFY_DEV: "true" },
      true,
    ],
  ])("keeps the cached connection: %s", async (_label, env, mainThread) => {
    const closeAll = vi.spyOn(MongoConnectionManager, "closeAll").mockResolvedValue();
    await MongoDevWorkerRelease.afterInvocation(env, mainThread);
    expect(closeAll).not.toHaveBeenCalled();
  });
});
