import {
  AdjudicationRubric,
  BoardConfig,
  KeywordCard,
  PerceptionSurvey,
  SemanticDomain,
} from "../../domain/curriculum-pack/curriculum-pack.types.js";

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
}

export interface CurriculumPackProjectionOptions {
  readonly includeAnswerKeys: boolean;
}
