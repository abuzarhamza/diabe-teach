// Curriculum Pack calls (docs/api/openapi.yaml, tag Packs). Reading the library needs no token; archive
// and unarchive send the teacher's Account Token (AccountAuth), never a Capability Token (ADR-0007).

import { accountFromSnapshot, readStoredAccountSnapshot } from "./account-token-store.ts";
import { ApiHttpError, apiRequest } from "./http-client.ts";

// docs/api/openapi.yaml BoardConfig.
export interface BoardConfig {
  rows: number;
  cols: number;
  minChainLength: number;
  adjacencyRule: "chebyshev-8" | "orthogonal-4";
}

// docs/api/openapi.yaml CurriculumPackListItem: the latest Pack Version of a pack in the library.
export interface CurriculumPackListItem {
  id: string;
  title: string;
  version: string;
  subjectDomain: string;
  boardConfig: BoardConfig;
  cardCount: number;
  domainCount: number;
  hasAssessmentInstrument: boolean;
  hasPerceptionSurvey: boolean;
  // The releasing teacher's email before the @, or null (older packs and System Packs).
  authorHandle: string | null;
  isArchived: boolean;
  // A built-in System Pack: archiving it or giving it a new version is refused (403 PACK_IS_SYSTEM_PACK).
  isSystemPack: boolean;
}

// docs/api/openapi.yaml SemanticDomain.
export interface SemanticDomain {
  id: string;
  label: string;
  description: string;
}

// docs/api/openapi.yaml KeywordCard.
export interface KeywordCard {
  id: string;
  verbatimLabel: string;
  displayLabel: string;
  aliases: string[];
  domainId: string;
  summary: string;
}

// docs/api/openapi.yaml CalibrationExample.
export interface CalibrationExample {
  id: string;
  title: string;
  path: { row: number; col: number }[];
  keywordIds: string[];
  narrativeExplanation: string;
  isValid: boolean;
}

// docs/api/openapi.yaml AdjudicationRubric.
export interface AdjudicationRubric {
  evaluatorPersona: string;
  subjectDomain: string;
  chainContinuityCriteria: string[];
  calibrationBoardCardIds?: string[][];
  calibrationExamples: CalibrationExample[];
}

// docs/api/openapi.yaml PublicAssessmentQuestion (answer keys are redacted without an instructor token).
export interface PublicAssessmentQuestion {
  id: string;
  bloomLevel: 2 | 3;
  stem: string;
  options: string[];
  relatedKeywordIds: string[];
  correctIndex?: number;
  explanation?: string;
}

// docs/api/openapi.yaml PerceptionSurveyItem.
export interface PerceptionSurveyItem {
  id: string;
  prompt: string;
}

// docs/api/openapi.yaml CurriculumPackDetail: a pack's content plus whether it is a System Pack.
export interface CurriculumPackDetail {
  id: string;
  title: string;
  version: string;
  description: string;
  boardConfig: BoardConfig;
  domains: SemanticDomain[];
  cards: KeywordCard[];
  adjudicationRubric: AdjudicationRubric;
  assessmentInstrument?: { questions: PublicAssessmentQuestion[] } | null;
  perceptionSurvey?: { items: PerceptionSurveyItem[] } | null;
  isSystemPack: boolean;
}

export interface ListPacksOptions {
  // Also list packs whose latest version is archived (marked isArchived: true).
  includeArchived: boolean;
}

function packPath(packId: string): string {
  return `/api/v1/packs/${encodeURIComponent(packId)}`;
}

// GET /api/v1/packs (200): no token. `includeArchived=true` is sent only when asked for.
export async function listPacks({ includeArchived }: ListPacksOptions): Promise<CurriculumPackListItem[]> {
  const path = includeArchived
    ? "/api/v1/packs?includeArchived=true"
    : "/api/v1/packs";
  const response = await apiRequest<{ packs: CurriculumPackListItem[] }>("GET", path);
  return response.packs;
}

// GET /api/v1/packs/{packId} (200): no token, so assessment answer keys stay redacted.
export async function getPackById(packId: string): Promise<CurriculumPackDetail> {
  const response = await apiRequest<{ pack: CurriculumPackDetail }>("GET", packPath(packId));
  return response.pack;
}

// docs/api/openapi.yaml archiveCurriculumPack / unarchiveCurriculumPack 200 bodies.
export interface PackArchived {
  packId: string;
  isArchived: true;
  archivedAt: string;
  archivedBy: string;
}

export interface PackUnarchived {
  packId: string;
  isArchived: false;
  unarchivedAt: string;
  unarchivedBy: string;
}

// The stored Account Token, or the 401 the server would give without one (nothing is sent).
function accountToken(): string {
  const account = accountFromSnapshot(readStoredAccountSnapshot());
  if (!account)
    throw new ApiHttpError(401, "UNAUTHORIZED_TOKEN", "Sign in to continue.");
  return account.accountToken;
}

// POST /api/v1/packs/{packId}/archive (200) with the Account Token. A System Pack is refused with 403
// PACK_IS_SYSTEM_PACK; an archived one with 409 PACK_ALREADY_ARCHIVED.
export async function archivePack(packId: string): Promise<PackArchived> {
  return apiRequest<PackArchived>("POST", `${packPath(packId)}/archive`, {
    auth: {
      kind: "account",
      token: accountToken(),
    },
  });
}

// POST /api/v1/packs/{packId}/unarchive (200) with the Account Token. A pack that is not archived is
// refused with 409 PACK_NOT_ARCHIVED.
export async function unarchivePack(packId: string): Promise<PackUnarchived> {
  return apiRequest<PackUnarchived>("POST", `${packPath(packId)}/unarchive`, {
    auth: {
      kind: "account",
      token: accountToken(),
    },
  });
}

// docs/api/openapi.yaml CurriculumPackInput: a pack's content as registered (a new pack, or a new Pack
// Version under an existing id).
export interface CurriculumPackInput {
  id: string;
  title: string;
  version: string;
  description: string;
  boardConfig: BoardConfig;
  domains: SemanticDomain[];
  cards: KeywordCard[];
  adjudicationRubric: AdjudicationRubric;
  assessmentInstrument: { questions: PublicAssessmentQuestion[] } | null;
  perceptionSurvey: { items: PerceptionSurveyItem[] } | null;
}

// docs/api/openapi.yaml PackValidationIssue.
export interface PackValidationIssue {
  path: string;
  code: string;
  message: string;
}

// docs/api/openapi.yaml registerCurriculumPack 201 body.
export interface PackRegistered {
  packId: string;
  version: string;
  warnings: PackValidationIssue[];
}

// POST /api/v1/packs (201) with the Account Token. An existing id and version is refused with 409
// PACK_ALREADY_EXISTS; a new version of a System Pack with 403 PACK_IS_SYSTEM_PACK.
export async function registerPack(input: CurriculumPackInput): Promise<PackRegistered> {
  return apiRequest<PackRegistered>("POST", "/api/v1/packs", {
    body: input,
    auth: {
      kind: "account",
      token: accountToken(),
    },
  });
}

// docs/api/openapi.yaml validateCurriculumPack 200 body: `valid` is true when `errors` is empty;
// warnings never make a pack invalid.
export interface PackValidation {
  valid: boolean;
  errors: PackValidationIssue[];
  warnings: PackValidationIssue[];
}

// POST /api/v1/packs/validate (200) with the Account Token: a dry run that saves nothing. A body that
// fails the CurriculumPackInput schema is refused with 400 INVALID_REQUEST_BODY (details.field, reason).
export async function validatePack(input: CurriculumPackInput): Promise<PackValidation> {
  return apiRequest<PackValidation>("POST", "/api/v1/packs/validate", {
    body: input,
    auth: {
      kind: "account",
      token: accountToken(),
    },
  });
}
