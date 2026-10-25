import {
  AdjudicationRubric,
  BoardConfig,
  CurriculumPack,
  KeywordCard,
  PerceptionSurvey,
  SemanticDomain,
} from "../../domain/curriculum-pack/curriculum-pack.js";

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

export class CurriculumPackProjector {
  public static toPublicDto(
    pack: CurriculumPack,
    options: { readonly includeAnswerKeys: boolean },
  ): PublicCurriculumPackDto {
    return {
      id: pack.id.value,
      title: pack.title,
      version: pack.version,
      description: pack.description,
      boardConfig: pack.boardConfig,
      domains: pack.domains,
      cards: pack.cards,
      adjudicationRubric: pack.adjudicationRubric,
      assessmentInstrument: pack.assessmentInstrument
        ? {
            questions: pack.assessmentInstrument.questions.map((q) => {
              const baseQuestion: PublicAssessmentQuestionDto = {
                id: q.id,
                bloomLevel: q.bloomLevel,
                stem: q.stem,
                options: q.options,
                relatedKeywordIds: q.relatedKeywordIds,
              };
              if (options.includeAnswerKeys) {
                return {
                  ...baseQuestion,
                  correctIndex: q.correctIndex,
                  explanation: q.explanation,
                };
              }
              return baseQuestion;
            }),
          }
        : null,
      perceptionSurvey: pack.perceptionSurvey,
    };
  }
}
