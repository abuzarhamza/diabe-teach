import type {
  AdjudicationRubric,
  AssessmentInstrument,
  BoardConfig,
  CurriculumPackProps,
  KeywordCard,
  PerceptionSurvey,
  SemanticDomain,
} from "./curriculum-pack.types.js";
import { PackId } from "./pack-id.js";

interface CardIndices {
  readonly byId: ReadonlyMap<string, KeywordCard>;
  readonly byLookup: ReadonlyMap<string, KeywordCard>;
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
    this.id = props.id instanceof PackId
      ? props.id
      : PackId.create(props.id);
    this.title = props.title;
    this.version = props.version;
    this.description = props.description;
    this.boardConfig = CurriculumPack.#deepFreeze({ ...props.boardConfig });
    this.domains = CurriculumPack.#deepFreeze(
      props.domains.map(d => ({ ...d })),
    );
    this.cards = CurriculumPack.#deepFreeze(
      props.cards.map(c => ({
        ...c,
        aliases: [...c.aliases],
      })),
    );
    this.adjudicationRubric = CurriculumPack.#cloneRubric(
      props.adjudicationRubric,
    );
    this.assessmentInstrument = CurriculumPack.#cloneAssessment(
      props.assessmentInstrument,
    );
    this.perceptionSurvey = CurriculumPack.#cloneSurvey(props.perceptionSurvey);

    const { byId, byLookup } = CurriculumPack.#buildCardIndices(this.cards);
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
      this.#cardsById.get(query)
      ?? this.#cardsByLookupKey.get(CurriculumPack.#normalizeLookupKey(query))
    );
  }

  static #cloneRubric(rubric: AdjudicationRubric): AdjudicationRubric {
    return CurriculumPack.#deepFreeze({
      evaluatorPersona: rubric.evaluatorPersona,
      subjectDomain: rubric.subjectDomain,
      chainContinuityCriteria: [...rubric.chainContinuityCriteria],
      ...(rubric.calibrationBoardCardIds
        ? {
            calibrationBoardCardIds: rubric.calibrationBoardCardIds.map(
              row => [...row],
            ),
          }
        : {}),
      calibrationExamples: rubric.calibrationExamples.map(ex => ({
        ...ex,
        path: ex.path.map(coord => ({ ...coord })),
        keywordIds: [...ex.keywordIds],
      })),
    });
  }

  static #cloneAssessment(
    instrument: AssessmentInstrument | null,
  ): AssessmentInstrument | null {
    if (!instrument)
      return null;
    return CurriculumPack.#deepFreeze({
      questions: instrument.questions.map(q => ({
        ...q,
        options: [...q.options] as const,
        relatedKeywordIds: [...q.relatedKeywordIds],
      })),
    });
  }

  static #cloneSurvey(
    survey: PerceptionSurvey | null,
  ): PerceptionSurvey | null {
    if (!survey)
      return null;
    return CurriculumPack.#deepFreeze({
      items: survey.items.map(item => ({ ...item })),
    });
  }

  static #buildCardIndices(cards: readonly KeywordCard[]): CardIndices {
    const byId = new Map<string, KeywordCard>();
    const byLookup = new Map<string, KeywordCard>();

    for (const card of cards) {
      byId.set(card.id, card);
      const keys = [
        card.id,
        card.verbatimLabel,
        card.displayLabel,
        ...card.aliases,
      ];
      for (const key of keys) {
        byLookup.set(CurriculumPack.#normalizeLookupKey(key), card);
      }
    }

    return { byId, byLookup };
  }

  static #normalizeLookupKey(text: string): string {
    return text.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  }

  static #deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (
        value !== null
        && typeof value === "object"
        && !Object.isFrozen(value)
      ) {
        CurriculumPack.#deepFreeze(value);
      }
    }
    return obj;
  }
}
