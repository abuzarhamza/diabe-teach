import { vi } from "vitest";

export interface FakeReply {
  status: number;
  body?: unknown;
}

// A reply may be given later (a function returning a promise, to hold the request pending or to answer
// from the request, e.g. its query), or "network-error" to make fetch itself reject, as it does when
// the API is not running.
export type FakeAnswer = FakeReply | "network-error" | ((request: RecordedRequest) => Promise<FakeReply>);

export interface RecordedRequest {
  method: string;
  path: string;
  // The query string as name → value (`{}` when there is none); replies are still looked up by path only.
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

// Replaces the global fetch with one that answers per "METHOD /path" with contract-shaped JSON,
// and records every request so a test can check what was sent.
export function installFakeFetch(replies: Record<string, FakeAnswer>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const url = new URL(input, "http://localhost:5173");
    const path = url.pathname;
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const request: RecordedRequest = {
      method,
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      headers,
      body: typeof init.body === "string"
        ? JSON.parse(init.body)
        : undefined,
    };
    requests.push(request);
    const answer = replies[`${method} ${path}`];
    if (answer === "network-error")
      throw new TypeError("Failed to fetch");
    const reply = typeof answer === "function"
      ? await answer(request)
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
