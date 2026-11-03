import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from "aws-lambda";
import type { Context } from "@netlify/functions";

/**
 * Converts a Netlify v2 Request to AWS Lambda APIGatewayProxyEvent format.
 */
async function requestToLambdaEvent(
  request: Request,
  context: Context,
): Promise<APIGatewayProxyEvent> {
  const url = new URL(request.url);
  const body = request.body ? await request.text() : null;
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    httpMethod: request.method,
    path: url.pathname,
    pathParameters: context.params ?? null,
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
 * Wraps a Lambda-style handler to work with Netlify v2 runtime.
 */
export function wrapLambdaHandler(handler: LambdaHandler) {
  return async (request: Request, context: Context): Promise<Response> => {
    const event = await requestToLambdaEvent(request, context);

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
