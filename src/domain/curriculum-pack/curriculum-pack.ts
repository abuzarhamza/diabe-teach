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
  /** Minimum chain length for a pack whose `boardConfig` doesn't set one. */
  public static readonly DEFAULT_MIN_CHAIN_LENGTH = 4;

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
  public readonly isSystemPack: boolean;
  public readonly isArchived: boolean;
  public readonly createdBy: string | null;
  public readonly authorName: string | null;
  public readonly createdAt: Date;
  public readonly archivedAt: Date | null;
  public readonly archivedBy: string | null;
  public readonly unarchivedAt: Date | null;
  public readonly unarchivedBy: string | null;

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
    this.isSystemPack = props.isSystemPack;
    this.isArchived = props.isArchived;
    this.createdBy = props.createdBy;
    this.authorName = props.authorName;
    this.createdAt = new Date(props.createdAt);
    this.archivedAt = props.archivedAt
      ? new Date(props.archivedAt)
      : null;
    this.archivedBy = props.archivedBy ?? null;
    this.unarchivedAt = props.unarchivedAt
      ? new Date(props.unarchivedAt)
      : null;
    this.unarchivedBy = props.unarchivedBy ?? null;

    const { byId, byLookup } = CurriculumPack.#buildCardIndices(this.cards);
    this.#cardsById = byId;
    this.#cardsByLookupKey = byLookup;
    Object.freeze(this);
  }

  public static create(props: CurriculumPackProps): CurriculumPack {
    return new CurriculumPack(props);
  }

  /**
   * Archives the pack, recording who did it and when. The last unarchive
   * stays recorded too, so the pack's history can be explained.
   */
  public archive(
    archivedAt: Date = new Date(),
    archivedBy: string | null = null,
  ): CurriculumPack {
    return new CurriculumPack({
      ...this.#props(),
      isArchived: true,
      archivedAt,
      archivedBy,
    });
  }

  /**
   * Unarchives the pack, recording who did it and when. The last archive
   * (`archivedAt`, `archivedBy`) stays recorded.
   */
  public unarchive(
    unarchivedAt: Date = new Date(),
    unarchivedBy: string | null = null,
  ): CurriculumPack {
    return new CurriculumPack({
      ...this.#props(),
      isArchived: false,
      unarchivedAt,
      unarchivedBy,
    });
  }

  #props(): CurriculumPackProps {
    return {
      id: this.id,
      title: this.title,
      version: this.version,
      description: this.description,
      boardConfig: this.boardConfig,
      domains: this.domains,
      cards: this.cards,
      adjudicationRubric: this.adjudicationRubric,
      assessmentInstrument: this.assessmentInstrument,
      perceptionSurvey: this.perceptionSurvey,
      isSystemPack: this.isSystemPack,
      isArchived: this.isArchived,
      createdBy: this.createdBy,
      authorName: this.authorName,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
      archivedBy: this.archivedBy,
      unarchivedAt: this.unarchivedAt,
      unarchivedBy: this.unarchivedBy,
    };
  }

  /**
   * The fewest cells a Concept Chain in this pack may have: the pack's
   * `boardConfig.minChainLength`, or {@link CurriculumPack.DEFAULT_MIN_CHAIN_LENGTH}
   * when a stored pack doesn't set one.
   */
  public get minChainLength(): number {
    const configured = (this.boardConfig as Partial<BoardConfig> | undefined)?.minChainLength;
    return typeof configured === "number" && Number.isInteger(configured) && configured >= 2
      ? configured
      : CurriculumPack.DEFAULT_MIN_CHAIN_LENGTH;
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
