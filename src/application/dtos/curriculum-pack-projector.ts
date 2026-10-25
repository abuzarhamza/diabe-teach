import {
  AdjacencyRule,
  CalibrationExample,
  CurriculumPack,
  KeywordCard,
  PerceptionSurveyItem,
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
  readonly boardConfig: {
    readonly rows: number;
    readonly cols: number;
    readonly minChainLength: number;
    readonly adjacencyRule: AdjacencyRule;
  };
  readonly domains: readonly SemanticDomain[];
  readonly cards: readonly KeywordCard[];
  readonly adjudicationRubric: {
    readonly evaluatorPersona: string;
    readonly subjectDomain: string;
    readonly chainContinuityCriteria: readonly string[];
    readonly calibrationBoardCardIds?: readonly (readonly string[])[];
    readonly calibrationExamples: readonly CalibrationExample[];
  };
  readonly assessmentInstrument: {
    readonly questions: readonly PublicAssessmentQuestionDto[];
  } | null;
  readonly perceptionSurvey: {
    readonly items: readonly PerceptionSurveyItem[];
  } | null;
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
      boardConfig: {
        rows: pack.boardConfig.rows,
        cols: pack.boardConfig.cols,
        minChainLength: pack.boardConfig.minChainLength,
        adjacencyRule: pack.boardConfig.adjacencyRule,
      },
      domains: pack.domains.map((d) => ({ ...d })),
      cards: pack.cards.map((c) => ({
        ...c,
        aliases: [...c.aliases],
      })),
      adjudicationRubric: {
        evaluatorPersona: pack.adjudicationRubric.evaluatorPersona,
        subjectDomain: pack.adjudicationRubric.subjectDomain,
        chainContinuityCriteria: [
          ...pack.adjudicationRubric.chainContinuityCriteria,
        ],
        ...(pack.adjudicationRubric.calibrationBoardCardIds
          ? {
              calibrationBoardCardIds:
                pack.adjudicationRubric.calibrationBoardCardIds.map((row) => [
                  ...row,
                ]),
            }
          : {}),
        calibrationExamples: pack.adjudicationRubric.calibrationExamples.map(
          (ex) => ({
            ...ex,
            path: ex.path.map((coord) => ({ ...coord })),
            keywordIds: [...ex.keywordIds],
          }),
        ),
      },
      assessmentInstrument: pack.assessmentInstrument
        ? {
            questions: pack.assessmentInstrument.questions.map((q) => {
              const baseQuestion: PublicAssessmentQuestionDto = {
                id: q.id,
                bloomLevel: q.bloomLevel,
                stem: q.stem,
                options: [...q.options] as const,
                relatedKeywordIds: [...q.relatedKeywordIds],
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
      perceptionSurvey: pack.perceptionSurvey
        ? {
            items: pack.perceptionSurvey.items.map((item) => ({ ...item })),
          }
        : null,
    };
  }
}
