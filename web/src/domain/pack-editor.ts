// Pack Editor rules: cleaning pasted words, sizing the board, making ids, and building the
// CurriculumPackInput of a new pack. Pure rules: no React, no fetch, no storage. Ported from the
// prototype (cleanKeywords in claudPoc/concept-chain/shared.js; slug, cardIds and packInput without
// `base` in claudPoc/concept-chain/account-api.js; newPackId in setup.html).

// A pack needs at least 9 distinct words, enough for the smallest (3 × 3) board.
export const MIN_PACK_WORDS = 9;
const MIN_BOARD_SIZE = 3;
const MAX_NEW_PACK_BOARD_SIZE = 7;

export interface CleanedWords {
  words: string[];
  // How many blank entries were dropped.
  empty: number;
  // How many repeats (ignoring case) were dropped.
  duplicates: number;
}

// Splits text (or takes a list) into words: on newlines, commas, semicolons and tabs; trims, unquotes
// CSV-style "…", collapses inner spaces, and drops blanks and case-insensitive duplicates.
export function cleanWords(input: string | readonly string[]): CleanedWords {
  const raw = typeof input === "string"
    ? input.trimEnd().split(/\r?\n|[,;\t]/)
    : [...input];
  const seen = new Set<string>();
  const words: string[] = [];
  let empty = 0;
  let duplicates = 0;
  for (const entry of raw) {
    const word = entry.trim().replace(/^"(.*)"$/, "$1").replaceAll("\"\"", "\"").replace(/\s+/g, " ").trim();
    if (!word) {
      empty++;
      continue;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    words.push(word);
  }
  return { words, empty, duplicates };
}

// The board side for a new pack of `wordCount` words: floor(sqrt(n)), clamped to 3..7.
export function newPackBoardSize(wordCount: number): number {
  return Math.max(MIN_BOARD_SIZE, Math.min(MAX_NEW_PACK_BOARD_SIZE, Math.floor(Math.sqrt(wordCount))));
}

// Lowercase ASCII with hyphens: "Beta cell" → "beta-cell".
export function slug(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id) || id.length < 2)
    id = `${base}-${n++}`;
  return id;
}

// A pack id for a new pack: its name as a slug (no leading digits), made unique with -2, -3… against
// every pack id in the library, archived ones included.
export function newPackId(name: string, takenIds: readonly string[]): string {
  const base = slug(name).replace(/^[^a-z]+/, "") || "pack";
  return uniqueId(base, new Set(takenIds));
}

// A unique card id for each word (a slug, made unique with -2, -3…).
export function cardIds(words: readonly string[], taken = new Set<string>()): string[] {
  return words.map((word) => {
    const id = uniqueId(slug(word) || "card", taken);
    taken.add(id);
    return id;
  });
}

export function normalisedName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// What the teacher typed in the editor for a new pack.
export interface NewPackDraft {
  name: string;
  level: string;
  objective: string;
  words: readonly string[];
}

export type PackEditorField = "words" | "name";

export interface PackEditorProblem {
  sentence: string;
  // The field to put focus on, so the teacher can fix it.
  field: PackEditorField;
}

// The local check before anything is sent: a name and at least 9 distinct words.
export function newPackProblem({ name, words }: Pick<NewPackDraft, "name" | "words">): PackEditorProblem | null {
  if (words.length < MIN_PACK_WORDS) {
    return {
      sentence: `A pack needs at least ${MIN_PACK_WORDS} different words (a 3 × 3 board); this one has ${words.length}.`,
      field: "words",
    };
  }
  if (!normalisedName(name))
    return { sentence: "Give the pack a name.", field: "name" };
  return null;
}

// The new pack's body (docs/api/openapi.yaml CurriculumPackInput), structurally: version 1.0.0, one
// Semantic Domain "general", one plain card per word, a one-line Adjudication Rubric, no assessment
// and no survey.
export interface NewPackInput {
  id: string;
  title: string;
  version: string;
  description: string;
  boardConfig: { rows: number; cols: number; minChainLength: number; adjacencyRule: "chebyshev-8" };
  domains: { id: string; label: string; description: string }[];
  cards: { id: string; verbatimLabel: string; displayLabel: string; aliases: string[]; domainId: string; summary: string }[];
  adjudicationRubric: {
    evaluatorPersona: string;
    subjectDomain: string;
    chainContinuityCriteria: string[];
    calibrationExamples: never[];
  };
  assessmentInstrument: null;
  perceptionSurvey: null;
}

// Builds a new pack from the draft; its id is made unique against `takenIds` (every pack in the library).
export function newPackInput(draft: NewPackDraft, takenIds: readonly string[]): NewPackInput {
  const title = normalisedName(draft.name);
  const description = [draft.level, draft.objective].map(part => part.trim()).filter(Boolean).join(" · ");
  const size = newPackBoardSize(draft.words.length);
  return {
    id: newPackId(title, takenIds),
    title,
    version: "1.0.0",
    description: description || title,
    boardConfig: {
      rows: size,
      cols: size,
      minChainLength: 2,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      { id: "general", label: "General", description: `Keywords of ${title}` },
    ],
    cards: cardIds(draft.words).map((id, i) => {
      const word = draft.words[i]!;
      return {
        id,
        verbatimLabel: word,
        displayLabel: word,
        aliases: [],
        domainId: "general",
        summary: word,
      };
    }),
    adjudicationRubric: {
      evaluatorPersona: "Teacher",
      subjectDomain: title,
      chainContinuityCriteria: ["Each link names a cause, mechanism or consequence"],
      calibrationExamples: [],
    },
    assessmentInstrument: null,
    perceptionSurvey: null,
  };
}
