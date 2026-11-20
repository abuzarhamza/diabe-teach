import type { Response } from "supertest";
import request from "supertest";
import { getTestConfig } from "./test-config-loader.js";

const config = getTestConfig();
const BASE_URL = process.env.NETLIFY_DEV_URL || config.env.base_url;
const API_KEY = config.env.api_key;

/**
 * Converts supertest Response to AWS Lambda APIGatewayProxyResult format
 * for compatibility with existing test assertions
 */
function toApiGatewayResult(res: Response) {
  return {
    statusCode: res.status,
    headers: res.headers as Record<string, string>,
    body: typeof res.body === "object"
      ? JSON.stringify(res.body)
      : res.text,
  };
}

export async function createSession(body: {
  packId: string;
  mode: "solo" | "classroom" | "study-rct";
  adjudicationMode: "ai" | "peer-instructor" | "hybrid";
  creatorDisplayName?: string;
  timerConfig?: Record<string, number | null>;
}, accountToken?: string) {
  const req = request(BASE_URL)
    .post("/api/v1/sessions")
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY);
  if (accountToken) {
    req.set("Authorization", `Bearer ${accountToken}`);
  }
  const res = await req.send(body);

  return toApiGatewayResult(res);
}

export async function joinSession(body: {
  roomCode?: string;
  displayName?: string;
}) {
  const res = await request(BASE_URL)
    .post("/api/v1/sessions/join")
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .send(body);

  return toApiGatewayResult(res);
}

export async function getSession(sessionId: string, token: string) {
  const res = await request(BASE_URL)
    .get(`/api/v1/sessions/${sessionId}`)
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`);

  return toApiGatewayResult(res);
}

export async function transitionPhase(
  sessionId: string,
  token: string,
  body: {
    action?: "advance" | "jump";
    targetPhase?: string;
    seed?: string;
  } = {},
) {
  const res = await request(BASE_URL)
    .post(`/api/v1/sessions/${sessionId}/phase`)
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  return toApiGatewayResult(res);
}

export async function submitChain(
  sessionId: string,
  roundNumber: number,
  token: string,
  body: {
    path: Array<{ row: number; col: number }>;
    keywordIds?: string[];
    narrativeExplanation: string;
    stepRationales?: string[];
  },
) {
  const res = await request(BASE_URL)
    .post(`/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains`)
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  return toApiGatewayResult(res);
}

export async function adjudicateChain(
  sessionId: string,
  roundNumber: number,
  chainId: string,
  token: string,
  body: {
    action?: "peer-approve" | "peer-challenge" | "ai-evaluate" | "instructor-approve" | "instructor-reject";
    comment?: string;
    feedback?: string;
    qualityScore?: number;
  } = {},
) {
  const res = await request(BASE_URL)
    .post(`/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains/${chainId}/adjudicate`)
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  return toApiGatewayResult(res);
}

export async function listRoundChains(
  sessionId: string,
  roundNumber: number,
  token: string,
) {
  const res = await request(BASE_URL)
    .get(`/api/v1/sessions/${sessionId}/rounds/${roundNumber}/chains`)
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`);

  return toApiGatewayResult(res);
}

export async function getStandings(
  sessionId: string,
  roundNumber: number,
  token: string,
) {
  const res = await request(BASE_URL)
    .get(`/api/v1/sessions/${sessionId}/rounds/${roundNumber}/standings`)
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`);

  return toApiGatewayResult(res);
}

export async function submitAssessment(
  sessionId: string,
  stage: "pretest" | "posttest",
  token: string,
  answers: Record<string, 0 | 1 | 2 | 3 | "I_DONT_KNOW">,
) {
  const res = await request(BASE_URL)
    .post(`/api/v1/sessions/${sessionId}/assessments/${stage}`)
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`)
    .send({ answers });

  return toApiGatewayResult(res);
}

export async function submitSurvey(
  sessionId: string,
  token: string,
  responses: Record<string, number>,
  comments?: string,
) {
  const body: { responses: Record<string, number>; comments?: string } = { responses };
  if (comments !== undefined) {
    body.comments = comments;
  }

  const res = await request(BASE_URL)
    .post(`/api/v1/sessions/${sessionId}/survey`)
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  return toApiGatewayResult(res);
}

export async function signUpInstructor(body: { email?: string; password?: string }) {
  const res = await request(BASE_URL)
    .post("/api/v1/accounts/sign-up")
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .send(body);

  return toApiGatewayResult(res);
}

export async function signInInstructor(body: { email?: string; password?: string }) {
  const res = await request(BASE_URL)
    .post("/api/v1/accounts/sign-in")
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY)
    .send(body);

  return toApiGatewayResult(res);
}

/** POST /api/v1/packs, the documented registration path, with an optional bearer token. */
export async function registerPack(body: Record<string, unknown>, token?: string) {
  const req = request(BASE_URL)
    .post("/api/v1/packs")
    .set("Content-Type", "application/json")
    .set("x-api-key", API_KEY);
  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }
  const res = await req.send(body);

  return toApiGatewayResult(res);
}

/** GET /api/v1/packs, optionally with `includeArchived=true`. */
export async function listPacks(options: { includeArchived?: boolean } = {}) {
  const req = request(BASE_URL)
    .get("/api/v1/packs")
    .set("x-api-key", API_KEY);
  if (options.includeArchived) {
    req.query({ includeArchived: "true" });
  }
  const res = await req;

  return toApiGatewayResult(res);
}

/** POST /api/v1/packs/{packId}/archive with a teacher's Account Token. */
export async function archivePack(packId: string, accountToken: string) {
  const res = await request(BASE_URL)
    .post(`/api/v1/packs/${encodeURIComponent(packId)}/archive`)
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${accountToken}`);

  return toApiGatewayResult(res);
}

/** POST /api/v1/packs/{packId}/unarchive. */
export async function unarchivePack(packId: string, accountToken: string) {
  const res = await request(BASE_URL)
    .post(`/api/v1/packs/${encodeURIComponent(packId)}/unarchive`)
    .set("x-api-key", API_KEY)
    .set("Authorization", `Bearer ${accountToken}`);

  return toApiGatewayResult(res);
}

/** GET /api/v1/packs/{packId}. */
export async function getPackById(packId: string) {
  const res = await request(BASE_URL)
    .get(`/api/v1/packs/${encodeURIComponent(packId)}`)
    .set("x-api-key", API_KEY);

  return toApiGatewayResult(res);
}
