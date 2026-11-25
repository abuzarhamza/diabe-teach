import { vi } from "vitest";

export interface FakeReply {
  status: number;
  body?: unknown;
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

// Replaces the global fetch with one that answers per "METHOD /path" with contract-shaped JSON,
// and records every request so a test can check what was sent.
export function installFakeFetch(replies: Record<string, FakeReply>): RecordedRequest[] {
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
    const reply = replies[`${method} ${path}`] ?? {
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
