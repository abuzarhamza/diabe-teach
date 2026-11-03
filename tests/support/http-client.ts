import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { TestDependencies } from "./world.js";
import { createAdjudicateChainHandler } from "../../netlify/functions/sessions/adjudicate-chain.js";
import { createCreateSessionHandler } from "../../netlify/functions/sessions/create-session.js";
import { createGetSessionHandler } from "../../netlify/functions/sessions/get-session.js";
import { createGetStandingsHandler } from "../../netlify/functions/sessions/get-standings.js";
import { createJoinSessionHandler } from "../../netlify/functions/sessions/join-session.js";
import { createSubmitChainHandler } from "../../netlify/functions/sessions/submit-chain.js";
import { createTransitionPhaseHandler } from "../../netlify/functions/sessions/transition-phase.js";

function makeEvent(
  method: string,
  path: string,
  body: object | null,
  pathParameters: Record<string, string> | null = null,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    queryStringParameters: null,
    pathParameters,
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
  };
}

export async function createSession(
  deps: TestDependencies,
  body: {
    packId: string;
    mode: "solo" | "classroom" | "study-rct";
    adjudicationMode: "ai" | "peer-instructor" | "hybrid";
    creatorDisplayName?: string;
  },
): Promise<APIGatewayProxyResult> {
  const handler = createCreateSessionHandler({
    packRepo: deps.packRepo,
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenAdapter,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent("POST", "/api/v1/sessions", body);
  return handler(event, {} as never);
}

export async function joinSession(
  deps: TestDependencies,
  body: {
    roomCode: string;
    displayName: string;
  },
): Promise<APIGatewayProxyResult> {
  const handler = createJoinSessionHandler({
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenAdapter,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent("POST", "/api/v1/sessions/join", body);
  return handler(event, {} as never);
}

export async function getSession(
  deps: TestDependencies,
  sessionId: string,
  token: string,
): Promise<APIGatewayProxyResult> {
  const handler = createGetSessionHandler({
    sessionRepo: deps.sessionRepo,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent(
    "GET",
    `/api/v1/sessions/${sessionId}`,
    null,
    { sessionId },
    { authorization: `Bearer ${token}` },
  );

  return handler(event, {} as never);
}

export async function transitionPhase(
  deps: TestDependencies,
  sessionId: string,
  token: string,
  body: {
    action?: "advance" | "jump";
    targetPhase?: string;
    seed?: number;
  } = {},
): Promise<APIGatewayProxyResult> {
  const handler = createTransitionPhaseHandler({
    sessionRepo: deps.sessionRepo,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent(
    "POST",
    `/api/v1/sessions/${sessionId}/phase`,
    body,
    { sessionId },
    { authorization: `Bearer ${token}` },
  );

  return handler(event, {} as never);
}

export async function submitChain(
  deps: TestDependencies,
  sessionId: string,
  roundNumber: number,
  token: string,
  body: {
    path: Array<{ row: number; col: number }>;
    keywordIds: string[];
    narrativeExplanation: string;
    stepRationales?: string[];
  },
): Promise<APIGatewayProxyResult> {
  const handler = createSubmitChainHandler({
    sessionRepo: deps.sessionRepo,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent(
    "POST",
    `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains`,
    body,
    { sessionId, roundNumber: String(roundNumber) },
    { authorization: `Bearer ${token}` },
  );

  return handler(event, {} as never);
}

export async function adjudicateChain(
  deps: TestDependencies,
  sessionId: string,
  roundNumber: number,
  chainId: string,
  token: string,
  body: {
    action?: "peer-approve" | "peer-reject" | "instructor-final";
    comment?: string;
    feedback?: string;
    qualityScore?: number;
  } = {},
): Promise<APIGatewayProxyResult> {
  const handler = createAdjudicateChainHandler({
    sessionRepo: deps.sessionRepo,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent(
    "POST",
    `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains/${chainId}/adjudicate`,
    body,
    { sessionId, roundNumber: String(roundNumber), chainId },
    { authorization: `Bearer ${token}` },
  );

  return handler(event, {} as never);
}

export async function getStandings(
  deps: TestDependencies,
  sessionId: string,
  roundNumber: number,
  token: string,
): Promise<APIGatewayProxyResult> {
  const handler = createGetStandingsHandler({
    sessionRepo: deps.sessionRepo,
    tokenVerifier: deps.tokenAdapter,
    requireApiKey: false,
  });

  const event = makeEvent(
    "GET",
    `/api/v1/sessions/${sessionId}/rounds/${roundNumber}/standings`,
    null,
    { sessionId, roundNumber: String(roundNumber) },
    { authorization: `Bearer ${token}` },
  );

  return handler(event, {} as never);
}
