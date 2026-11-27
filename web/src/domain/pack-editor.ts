// Pack Editor rules: cleaning pasted words, sizing the board, making ids, and building the
// CurriculumPackInput of a new pack. Pure rules: no React, no fetch, no storage. Ported from the
// prototype (cleanKeywords in claudPoc/concept-chain/shared.js; slug, cardIds, nextVersion and packInput,
// with and without `base`, in claudPoc/concept-chain/account-api.js; newPackId in setup.html).

// A pack needs at least 9 distinct words, enough for the smallest (3 × 3) board.
export const MIN_PACK_WORDS = 9;
const MIN_BOARD_SIZE = 3;
const MAX_NEW_PACK_BOARD_SIZE = 7;
// The longest word a card may carry.
export const MAX_WORD_LENGTH = 60;
// The largest word file the editor reads (the prototype's limit).
const MAX_WORD_FILE_BYTES = 1024 * 1024;

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

// The word list after adding more words (pasted text, a file's text, or a pack's card labels):
// how many were added, and how many repeats (of each other or of the list) and blanks were dropped.
export interface WordsAdded extends CleanedWords {
  added: number;
}

export function addWords(current: readonly string[], input: string | readonly string[]): WordsAdded {
  const incoming = cleanWords(input);
  const merged = cleanWords([
    ...current,
    ...incoming.words,
  ]);
  return {
    words: merged.words,
    added: merged.words.length - current.length,
    empty: incoming.empty,
    duplicates: incoming.duplicates + merged.duplicates,
  };
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1
    ? one
    : many}`;
}

// "Added 4 words. Dropped 1 duplicate and 1 blank entry."; with a source (a file or a pack name),
// "From words.csv: added 4 words. …".
export function wordsAddedNote({ added, duplicates, empty }: WordsAdded, source?: string): string {
  const dropped = [
    duplicates && plural(duplicates, "duplicate"),
    empty && plural(empty, "blank entry", "blank entries"),
  ].filter(Boolean);
  const sentence = `added ${plural(added, "word")}.${dropped.length
    ? ` Dropped ${dropped.join(" and ")}.`
    : ""}`;
  return source
    ? `From ${source}: ${sentence}`
    : sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// How many more words a pack needs, or which board the list allows.
export function wordCountNote(wordCount: number): string {
  if (wordCount < MIN_PACK_WORDS)
    return `Add at least ${MIN_PACK_WORDS - wordCount} more to publish (a pack needs ${MIN_PACK_WORDS}, for a 3 × 3 board).`;
  const size = newPackBoardSize(wordCount);
  return `${plural(wordCount, "word")}: enough for a ${size} × ${size} board.`;
}

// The words of an existing pack: each card's display label, or its verbatim label.
export function packWords(pack: { cards: readonly { displayLabel: string; verbatimLabel: string }[] }): string[] {
  return pack.cards.map(card => card.displayLabel || card.verbatimLabel).filter(Boolean);
}

// Why a chosen file can't be read as a word list (not .txt/.csv, or over 1 MB), or null.
export function wordFileProblem({ name, size }: { name: string; size: number }): string | null {
  if (!/\.(?:txt|csv)$/i.test(name))
    return `“${name}” isn't a .txt or .csv file.`;
  if (size > MAX_WORD_FILE_BYTES)
    return `“${name}” is over 1 MB. Use a shorter list.`;
  return null;
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

// The local check before anything is sent: at least 9 distinct words, a name, and no word over 60
// characters.
export function newPackProblem({ name, words }: Pick<NewPackDraft, "name" | "words">): PackEditorProblem | null {
  if (words.length < MIN_PACK_WORDS) {
    return {
      sentence: `A pack needs at least ${MIN_PACK_WORDS} different words (a 3 × 3 board); this one has ${words.length}.`,
      field: "words",
    };
  }
  if (!normalisedName(name))
    return { sentence: "Give the pack a name.", field: "name" };
  const long = words.find(word => word.length > MAX_WORD_LENGTH);
  if (long) {
    return {
      sentence: `Keep each word to ${MAX_WORD_LENGTH} characters or fewer (“${long.slice(0, 30)}…”).`,
      field: "words",
    };
  }
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

// The Pack Version a new version releases: a minor bump of MAJOR.MINOR.PATCH ("1.1.0" → "1.2.0");
// any other version becomes "1.0.0".
export function nextVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.\d+$/.exec(version);
  return match
    ? `${match[1]}.${Number(match[2]) + 1}.0`
    : "1.0.0";
}

// A Keyword Card as a pack carries it.
export interface PackCard {
  id: string;
  verbatimLabel: string;
  displayLabel: string;
  aliases: string[];
  domainId: string;
  summary: string;
}

// The current Pack Version a new version is built from (a pack detail response satisfies it).
export interface PackVersionBase {
  id: string;
  title: string;
  version: string;
  description: string;
  boardConfig: { rows: number; cols: number };
  domains: readonly { id: string }[];
  cards: readonly PackCard[];
  adjudicationRubric: unknown;
  assessmentInstrument?: unknown;
  perceptionSurvey?: unknown;
}

// The new version's body: only CurriculumPackInput's fields, so response-only fields of the base
// (such as isSystemPack) are never sent.
export interface PackVersionInput<B extends PackVersionBase> {
  id: string;
  title: string;
  version: string;
  description: string;
  boardConfig: B["boardConfig"];
  domains: B["domains"];
  cards: PackCard[];
  adjudicationRubric: B["adjudicationRubric"];
  assessmentInstrument: Exclude<B["assessmentInstrument"], undefined> | null;
  perceptionSurvey: Exclude<B["perceptionSurvey"], undefined> | null;
}

// A new Pack Version of `base` from the draft: same id, the next version, and the title and description
// replaced only if given. Words matched to a card by label (ignoring case) keep that card unchanged;
// new words get new unique card ids in the first Semantic Domain. The board shrinks to fit the word
// count (never below 3 × 3). Domains, rubric, assessment and survey are kept.
export function packVersionInput<B extends PackVersionBase>(draft: NewPackDraft, base: B): PackVersionInput<B> {
  const title = normalisedName(draft.name);
  const description = [draft.level, draft.objective].map(part => part.trim()).filter(Boolean).join(" · ");
  const byLabel = new Map(base.cards.map(card => [
    (card.displayLabel || card.verbatimLabel).toLowerCase(),
    card,
  ]));
  const kept = draft.words.map(word => byLabel.get(word.toLowerCase()) ?? null);
  const keptIds = new Set(kept.filter(card => card !== null).map(card => card.id));
  const newIds = cardIds(draft.words.filter((_, i) => !kept[i]), keptIds);
  const domainId = base.domains[0]?.id ?? "general";
  let next = 0;
  const cards = draft.words.map((word, i) => kept[i] ?? {
    id: newIds[next++]!,
    verbatimLabel: word,
    displayLabel: word,
    aliases: [],
    domainId,
    summary: word,
  });
  const side = Math.max(MIN_BOARD_SIZE, Math.min(base.boardConfig.rows, Math.floor(Math.sqrt(cards.length))));
  return {
    id: base.id,
    title: title || base.title,
    version: nextVersion(base.version),
    description: description || base.description,
    boardConfig: { ...base.boardConfig, rows: side, cols: side },
    domains: base.domains,
    cards,
    adjudicationRubric: base.adjudicationRubric,
    assessmentInstrument: (base.assessmentInstrument ?? null) as PackVersionInput<B>["assessmentInstrument"],
    perceptionSurvey: (base.perceptionSurvey ?? null) as PackVersionInput<B>["perceptionSurvey"],
  };
}
