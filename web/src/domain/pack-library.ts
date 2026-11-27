// Curriculum Pack wording for the Pack Library, Pack Detail and Pack Editor screens. Pure rules: no React, no fetch,
// no storage. The wording copies the prototype (byline and packErrorText in
// claudPoc/concept-chain/account-api.js) so both screens say the same thing.

import type { ApiRefusal } from "./login-errors.ts";
import { NETWORK_ERROR_SENTENCE } from "./login-errors.ts";

// The fields of a pack list item the byline reads (CurriculumPackListItem satisfies it).
export interface PackBylineSource {
  authorHandle: string | null;
  version: string;
}

// "by rahman.s · v1.1.0"; a pack not released by a teacher (older packs, System Packs) is "by unknown".
export function packByline({ authorHandle, version }: PackBylineSource): string {
  return `by ${authorHandle ?? "unknown"} · v${version}`;
}

const PACK_REFUSAL_SENTENCES: Record<string, string> = {
  PACK_IS_SYSTEM_PACK: "Built-in System Packs can't be archived or given new versions.",
  PACK_ALREADY_ARCHIVED: "That pack is already archived.",
  PACK_NOT_ARCHIVED: "That pack is not archived.",
  PACK_ALREADY_EXISTS: "Someone released that version of this pack first. Reload the page and try again.",
  NETWORK_ERROR: NETWORK_ERROR_SENTENCE,
};

// A problem the pack validator found (docs/api/openapi.yaml PackValidationIssue; the API layer's type
// satisfies it). `path` names the part of the pack, like `cards[3].id`.
export interface PackIssue {
  path: string;
  code: string;
  message: string;
}

// The validator's findings: errors block publishing, warnings never do.
export interface PackIssues {
  errors: PackIssue[];
  warnings: PackIssue[];
}

const PART_NAMES: Record<string, string> = {
  id: "Pack id",
  title: "Pack name",
  version: "Version",
  description: "Description",
  boardConfig: "Board",
  domains: "Semantic Domains",
  cards: "Keyword Cards",
  adjudicationRubric: "Adjudication Rubric",
  assessmentInstrument: "Assessment questions",
  perceptionSurvey: "Perception survey",
};

// The part of the pack an issue path names, as a teacher reads it: "cards[3].id" is "Keyword Card 4",
// "boardConfig.rows" is "Board". An unknown path is named by itself.
export function packIssuePart(path: string): string {
  const match = /^([a-z]+)(?:\[(\d+)\])?/i.exec(path);
  const [, top = "", index] = match ?? [];
  const position = index === undefined
    ? null
    : Number(index) + 1;
  if (top === "cards" && position)
    return `Keyword Card ${position}`;
  if (top === "domains" && position)
    return `Semantic Domain ${position}`;
  return PART_NAMES[top] ?? path;
}

// One issue in plain language: "Keyword Card 4 (cards[3].id): Card id … is used more than once."
export function packIssueLine({ path, message }: PackIssue): string {
  return `${packIssuePart(path)} (${path}): ${message}`;
}

function isPackIssue(value: unknown): value is PackIssue {
  if (!value || typeof value !== "object")
    return false;
  const issue = value as Record<string, unknown>;
  return typeof issue.path === "string" && typeof issue.code === "string" && typeof issue.message === "string";
}

// The issues listed in a value (an array of PackValidationIssue), ignoring anything else.
export function packIssuesIn(value: unknown): PackIssue[] {
  return Array.isArray(value)
    ? value.filter(isPackIssue)
    : [];
}

// The issues a 422 PACK_VALIDATION_FAILED lists in `details`, or null for any other refusal.
export function packRefusalIssues(refusal: ApiRefusal): PackIssues | null {
  if (refusal.code !== "PACK_VALIDATION_FAILED")
    return null;
  return {
    errors: packIssuesIn(refusal.details?.errors),
    warnings: packIssuesIn(refusal.details?.warnings),
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1
    ? ""
    : "s"}`;
}

// The sentence for a pack route's refusal; codes without their own sentence keep the server's message.
// A 400 names the field the server refused; a 422 says how many errors are listed with it.
export function packRefusalSentence(refusal: ApiRefusal): string {
  if (refusal.code === "INVALID_REQUEST_BODY") {
    const { field, reason } = refusal.details ?? {};
    if (typeof field === "string" && typeof reason === "string")
      return `The server refused ${packIssuePart(field)} (${field}): ${reason}.`;
  }
  const issues = packRefusalIssues(refusal);
  if (issues)
    return `The server refused the pack: ${plural(issues.errors.length, "error")} to fix, listed below.`;
  return PACK_REFUSAL_SENTENCES[refusal.code] ?? refusal.message;
}

// What Check pack says above its lists: errors to fix, or that the pack can be published.
export function packCheckSummary({ errors }: PackIssues): string {
  return errors.length
    ? `${plural(errors.length, "error")} to fix before publishing.`
    : "No errors: the pack can be published.";
}

// The warnings a successful publish handed to Pack Detail in the router's location state
// (`{ publishWarnings }`), or none.
export function publishWarningsFrom(state: unknown): PackIssue[] {
  if (!state || typeof state !== "object")
    return [];
  return packIssuesIn((state as { publishWarnings?: unknown }).publishWarnings);
}

// The fields of a board configuration the summary reads (BoardConfig satisfies it).
export interface BoardSummarySource {
  rows: number;
  cols: number;
  minChainLength: number;
  adjacencyRule: "chebyshev-8" | "orthogonal-4";
}

const ADJACENCY_WORDS: Record<BoardSummarySource["adjacencyRule"], string> = {
  "chebyshev-8": "any of the 8 neighbouring cards",
  "orthogonal-4": "the card above, below, left or right",
};

// "7 × 7 board · chains of 4+ cards · any of the 8 neighbouring cards".
export function boardSummary({ rows, cols, minChainLength, adjacencyRule }: BoardSummarySource): string {
  return `${rows} × ${cols} board · chains of ${minChainLength}+ cards · ${ADJACENCY_WORDS[adjacencyRule]}`;
}
