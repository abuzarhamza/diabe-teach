// The single HTTP client of the web app (ADR-0008): every API call goes through apiRequest.
// It sends JSON, adds the optional x-api-key from build-time config (VITE_API_KEY, absent when the
// server runs with the key check off), adds `Authorization: Bearer <token>` only when the caller names
// the token kind (ADR-0007: an Account Token is never sent where a Capability Token is expected), and
// turns every refusal into an ApiHttpError carrying the server's { code, message, details }.

export type ApiErrorDetails = Record<string, unknown> | null;

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetails;

  constructor(status: number, code: string, message: string, details: ApiErrorDetails = null) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiAuth {
  kind: "account";
  token: string;
}

export interface ApiRequestOptions {
  body?: unknown;
  auth?: ApiAuth;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const NETWORK_ERROR_MESSAGE = "Can't reach the API. Start it with `npm run dev:local`.";

function requestHeaders(options: ApiRequestOptions): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined)
    headers["content-type"] = "application/json";
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey)
    headers["x-api-key"] = apiKey;
  if (options.auth)
    headers.authorization = `Bearer ${options.auth.token}`;
  return headers;
}

function parseJson(text: string): unknown {
  try {
    return text
      ? JSON.parse(text)
      : null;
  }
  catch {
    return null;
  }
}

function toApiHttpError(status: number, data: unknown): ApiHttpError {
  const body = (data && typeof data === "object"
    ? data
    : {}) as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof body.code === "string"
    ? body.code
    : `HTTP_${status}`;
  const message = typeof body.message === "string"
    ? body.message
    : `Request failed (${status}).`;
  const details = body.details && typeof body.details === "object"
    ? body.details as Record<string, unknown>
    : null;
  return new ApiHttpError(status, code, message, details);
}

function logInDevelopment(method: HttpMethod, path: string, status: number): void {
  if (import.meta.env.DEV)
    // eslint-disable-next-line no-console -- the `[API] METHOD path -> status` development log (ADR-0008)
    console.info(`[API] ${method} ${path} -> ${status}`);
}

export async function apiRequest<T>(method: HttpMethod, path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: requestHeaders(options),
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    });
  }
  catch {
    logInDevelopment(method, path, 0);
    throw new ApiHttpError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
  logInDevelopment(method, path, response.status);
  const data = parseJson(await response.text());
  if (!response.ok)
    throw toApiHttpError(response.status, data);
  return data as T;
}
