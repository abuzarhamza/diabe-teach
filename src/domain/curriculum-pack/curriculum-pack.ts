import {
  AdjudicationRubric,
  AssessmentInstrument,
  BoardConfig,
  CurriculumPackProps,
  KeywordCard,
  PerceptionSurvey,
  SemanticDomain,
} from "./curriculum-pack.types.js";
import { PackId } from "./pack-id.js";

function normalizeLookupKey(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export class CurriculumPack {
  public readonly id: PackId;
  public readonly title: string;
  public readonly version: string;
  public readonly description: string;
  public readonly boardConfig: BoardConfig;
  public readonly domains: readonly SemanticDomain[];
  public readonly cards: readonly KeywordCard[];
  public readonly adjudicationRubric: AdjudicationRubric;
  public readonly assessmentInstrument: AssessmentInstrument | null;
  public readonly perceptionSurvey: PerceptionSurvey | null;

  readonly #cardsById: ReadonlyMap<string, KeywordCard>;
  readonly #cardsByLookupKey: ReadonlyMap<string, KeywordCard>;

  private constructor(props: CurriculumPackProps) {
    this.id =
      props.id instanceof PackId ? props.id : PackId.create(props.id);
    this.title = props.title;
    this.version = props.version;
    this.description = props.description;
    this.boardConfig = deepFreeze({ ...props.boardConfig });
    this.domains = deepFreeze(props.domains.map((d) => ({ ...d })));
    this.cards = deepFreeze(
      props.cards.map((c) => ({
        ...c,
        aliases: [...c.aliases],
      })),
    );
    this.adjudicationRubric = deepFreeze({
      evaluatorPersona: props.adjudicationRubric.evaluatorPersona,
      subjectDomain: props.adjudicationRubric.subjectDomain,
      chainContinuityCriteria: [
        ...props.adjudicationRubric.chainContinuityCriteria,
      ],
      ...(props.adjudicationRubric.calibrationBoardCardIds
        ? {
            calibrationBoardCardIds:
              props.adjudicationRubric.calibrationBoardCardIds.map((row) => [
                ...row,
              ]),
          }
        : {}),
      calibrationExamples: props.adjudicationRubric.calibrationExamples.map(
        (ex) => ({
          ...ex,
          path: ex.path.map((coord) => ({ ...coord })),
          keywordIds: [...ex.keywordIds],
        }),
      ),
    });
    this.assessmentInstrument = props.assessmentInstrument
      ? deepFreeze({
          questions: props.assessmentInstrument.questions.map((q) => ({
            ...q,
            options: [...q.options] as const,
            relatedKeywordIds: [...q.relatedKeywordIds],
          })),
        })
      : null;
    this.perceptionSurvey = props.perceptionSurvey
      ? deepFreeze({
          items: props.perceptionSurvey.items.map((item) => ({ ...item })),
        })
      : null;

    const byId = new Map<string, KeywordCard>();
    const byLookup = new Map<string, KeywordCard>();

    for (const card of this.cards) {
      byId.set(card.id, card);
      byLookup.set(normalizeLookupKey(card.id), card);
      byLookup.set(normalizeLookupKey(card.verbatimLabel), card);
      byLookup.set(normalizeLookupKey(card.displayLabel), card);
      for (const alias of card.aliases) {
        byLookup.set(normalizeLookupKey(alias), card);
      }
    }

    this.#cardsById = byId;
    this.#cardsByLookupKey = byLookup;
    Object.freeze(this);
  }

  public static create(props: CurriculumPackProps): CurriculumPack {
    return new CurriculumPack(props);
  }

  public getCardById(cardId: string): KeywordCard | undefined {
    return this.#cardsById.get(cardId);
  }

  public resolveCardByLabelOrAlias(query: string): KeywordCard | undefined {
    return (
      this.#cardsById.get(query) ??
      this.#cardsByLookupKey.get(normalizeLookupKey(query))
    );
  }
}
