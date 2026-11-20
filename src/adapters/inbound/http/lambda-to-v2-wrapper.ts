import type { Context } from "@netlify/functions";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import type { RouteConfig } from "./lambda-to-v2-wrapper.types.js";
import { match } from "path-to-regexp";

/**
 * Suffixes `netlify dev` appends when it retries a request whose function
 * answered 403 or 404 (netlify-cli `alternativePathsFor`, "to mimic the CDN"):
 * `<path>.html`, `<path>.htm`, `<path>/index.html`, `<path>/index.htm`. The
 * retry reaches the same function, with empty or suffixed `context.params`.
 * Longest suffix first.
 */
const DEV_RETRY_SUFFIXES = [
  "/index.html",
  "/index.htm",
  ".html",
  ".htm",
] as const;

/**
 * An `/api/` path never names an HTML page, so a known retry suffix is removed
 * and the retry is read as the original request (same parameters, same answer).
 */
export function stripDevRetrySuffix(pathname: string): string {
  if (!pathname.startsWith("/api/")) {
    return pathname;
  }
  const suffix = DEV_RETRY_SUFFIXES.find(candidate => pathname.endsWith(candidate));
  return suffix
    ? pathname.slice(0, -suffix.length)
    : pathname;
}

function routePaths(config: RouteConfig): string[] {
  if (config.path === undefined) {
    return [];
  }
  return typeof config.path === "string"
    ? [config.path]
    : [...config.path];
}

function onlyStringParams(params: Partial<Record<string, string | string[]>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Route parameters for a request, read from the request URL by matching it
 * against the function's own `config.path` (ADR-0005: `path-to-regexp`).
 * `context.params` is only a cross-check, and the fallback when no declared
 * path matches.
 */
export function resolvePathParameters(
  pathname: string,
  config: RouteConfig,
  contextParams?: Record<string, string> | null,
): Record<string, string> | null {
  const requestPath = stripDevRetrySuffix(pathname);
  for (const routePath of routePaths(config)) {
    const matched = match(routePath, { decode: decodeURIComponent })(requestPath);
    if (matched) {
      const params = onlyStringParams(matched.params);
      warnOnParamMismatch(pathname, requestPath, params, contextParams);
      return params;
    }
  }
  return contextParams && Object.keys(contextParams).length > 0
    ? contextParams
    : null;
}

function warnOnParamMismatch(
  pathname: string,
  requestPath: string,
  params: Record<string, string>,
  contextParams?: Record<string, string> | null,
): void {
  // A dev retry legitimately disagrees with `context.params`; only a plain request is cross-checked.
  if (requestPath !== pathname || !contextParams || Object.keys(contextParams).length === 0) {
    return;
  }
  const differs = Object.entries(params).some(([key, value]) => contextParams[key] !== undefined && contextParams[key] !== value);
  if (differs) {
    console.warn(`Route parameters from the URL and context.params disagree for ${pathname}; using the URL.`);
  }
}

/**
 * Converts a Netlify v2 Request to AWS Lambda APIGatewayProxyEvent format.
 */
async function requestToLambdaEvent(
  request: Request,
  context: Context,
  config: RouteConfig,
): Promise<APIGatewayProxyEvent> {
  const url = new URL(request.url);
  const body = request.body
    ? await request.text()
    : null;
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    httpMethod: request.method,
    path: url.pathname,
    pathParameters: resolvePathParameters(url.pathname, config, context.params),
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers,
    body,
    isBase64Encoded: false,
    requestContext: {
      accountId: "",
      apiId: "",
      authorizer: null,
      protocol: "HTTP/1.1",
      httpMethod: request.method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: context.ip ?? "",
        user: null,
        userAgent: headers["user-agent"] ?? null,
        userArn: null,
      },
      path: url.pathname,
      stage: "dev",
      requestId: context.requestId,
      requestTimeEpoch: Date.now(),
      resourceId: "",
      resourcePath: url.pathname,
    },
    resource: url.pathname,
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
  };
}

/**
 * Converts Lambda APIGatewayProxyResult to v2 Response format.
 */
function lambdaResultToResponse(result: APIGatewayProxyResult): Response {
  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers as HeadersInit,
  });
}

type LambdaHandler = (event: APIGatewayProxyEvent, context: LambdaContext) => Promise<APIGatewayProxyResult>;

/**
 * Wraps a Lambda-style handler to work with Netlify v2 runtime. `config` is the
 * route file's own `export const config` (declared once); its `path` is matched
 * against the request URL to fill `event.pathParameters`.
 */
export function wrapLambdaHandler(handler: LambdaHandler, config: RouteConfig) {
  return async (request: Request, context: Context): Promise<Response> => {
    const event = await requestToLambdaEvent(request, context, config);

    // Create a minimal Lambda context
    const lambdaContext: LambdaContext = {
      callbackWaitsForEmptyEventLoop: true,
      functionName: "function",
      functionVersion: "1",
      invokedFunctionArn: "",
      memoryLimitInMB: "128",
      awsRequestId: context.requestId,
      logGroupName: "",
      logStreamName: "",
      getRemainingTimeInMillis: () => 60000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
    };

    const result = await handler(event, lambdaContext);
    return lambdaResultToResponse(result);
  };
}
