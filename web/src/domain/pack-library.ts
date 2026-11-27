// Curriculum Pack wording for the Pack Library and Pack Detail screens. Pure rules: no React, no fetch,
// no storage. The wording copies the prototype (byline and packErrorText in
// claudPoc/concept-chain/account-api.js) so both screens say the same thing.

import type { ApiRefusal } from "./login-errors.ts";

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
};

// The sentence for a pack route's refusal; codes without their own sentence keep the server's message.
export function packRefusalSentence(refusal: ApiRefusal): string {
  return PACK_REFUSAL_SENTENCES[refusal.code] ?? refusal.message;
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
