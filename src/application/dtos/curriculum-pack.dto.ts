import type {
  AdjudicationRubric,
  BoardConfig,
  KeywordCard,
  PerceptionSurvey,
  SemanticDomain,
} from "../../domain/curriculum-pack/curriculum-pack.types.js";

export interface CurriculumPackSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly subjectDomain: string;
  readonly boardConfig: BoardConfig;
  readonly cardCount: number;
  readonly domainCount: number;
  readonly hasAssessmentInstrument: boolean;
  readonly hasPerceptionSurvey: boolean;
}

/**
 * A pack as the pack list shows it: the summary of its latest Pack Version,
 * plus who released that version and whether the pack is archived.
 */
export interface CurriculumPackListItemDto extends CurriculumPackSummaryDto {
  /**
   * The releasing account's email before the @, or null when the version's
   * `createdBy` is not an Instructor Account (packs registered before
   * accounts, and System Packs). Never the full email.
   */
  readonly authorHandle: string | null;
  readonly isArchived: boolean;
  /**
   * True for a built-in System Pack, which teachers cannot archive or release
   * a new version of (`CurriculumPack.assertTeachersMayChange`).
   */
  readonly isSystemPack: boolean;
}

export interface PublicAssessmentQuestionDto {
  readonly id: string;
  readonly bloomLevel: 2 | 3;
  readonly stem: string;
  readonly options: readonly [string, string, string, string];
  readonly relatedKeywordIds: readonly string[];
  readonly correctIndex?: 0 | 1 | 2 | 3;
  readonly explanation?: string;
}

export interface PublicCurriculumPackDto {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly boardConfig: BoardConfig;
  readonly domains: readonly SemanticDomain[];
  readonly cards: readonly KeywordCard[];
  readonly adjudicationRubric: AdjudicationRubric;
  readonly assessmentInstrument: {
    readonly questions: readonly PublicAssessmentQuestionDto[];
  } | null;
  readonly perceptionSurvey: PerceptionSurvey | null;
  /** Same meaning as `CurriculumPackListItemDto.isSystemPack`. */
  readonly isSystemPack: boolean;
}

export interface CurriculumPackProjectionOptions {
  readonly includeAnswerKeys: boolean;
}
