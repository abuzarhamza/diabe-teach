import { vi } from "vitest";

export interface FakeReply {
  status: number;
  body?: unknown;
}

// A reply may be given later (a function returning a promise, to hold the request pending), or
// "network-error" to make fetch itself reject, as it does when the API is not running.
export type FakeAnswer = FakeReply | "network-error" | (() => Promise<FakeReply>);

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

// Replaces the global fetch with one that answers per "METHOD /path" with contract-shaped JSON,
// and records every request so a test can check what was sent.
export function installFakeFetch(replies: Record<string, FakeAnswer>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const path = new URL(input, "http://localhost:5173").pathname;
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    requests.push({
      method,
      path,
      headers,
      body: typeof init.body === "string"
        ? JSON.parse(init.body)
        : undefined,
    });
    const answer = replies[`${method} ${path}`];
    if (answer === "network-error")
      throw new TypeError("Failed to fetch");
    const reply = typeof answer === "function"
      ? await answer()
      : answer ?? {
        status: 404,
        body: { code: "NOT_FOUND", message: `No fake reply for ${method} ${path}.`, details: null },
      };
    return new Response(reply.body === undefined
      ? null
      : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  }));
  return requests;
}
