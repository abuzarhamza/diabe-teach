import { Writable } from "node:stream";

/**
 * Collects everything a logger writes, so tests can check the parsed JSON
 * lines or search the raw output. Used instead of pino-test, whose `once` and
 * `consecutive` assert that every line carries pino's default `pid` and
 * `hostname`, which our logger deliberately drops.
 */
export class InMemoryLogSink extends Writable {
  readonly #chunks: string[] = [];

  public constructor() {
    super({
      write: (chunk: Buffer | string, _encoding, callback) => {
        this.#chunks.push(chunk.toString());
        callback();
      },
    });
  }

  public get raw(): string {
    return this.#chunks.join("");
  }

  public lines(): Array<Record<string, unknown>> {
    return this.raw
      .split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as Record<string, unknown>);
  }
}
