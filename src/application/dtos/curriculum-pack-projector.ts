import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type {
  CurriculumPackListItemDto,
  CurriculumPackProjectionOptions,
  CurriculumPackSummaryDto,
  PublicAssessmentQuestionDto,
  PublicCurriculumPackDto,
} from "./curriculum-pack.dto.js";

export class CurriculumPackProjector {
  public static toSummaryDto(pack: CurriculumPack): CurriculumPackSummaryDto {
    return {
      id: pack.id.value,
      title: pack.title,
      version: pack.version,
      subjectDomain: pack.adjudicationRubric.subjectDomain,
      boardConfig: pack.boardConfig,
      cardCount: pack.cards.length,
      domainCount: pack.domains.length,
      hasAssessmentInstrument: pack.assessmentInstrument !== null,
      hasPerceptionSurvey: pack.perceptionSurvey !== null,
    };
  }

  public static toListItemDto(
    pack: CurriculumPack,
    authorHandle: string | null,
  ): CurriculumPackListItemDto {
    return {
      ...CurriculumPackProjector.toSummaryDto(pack),
      authorHandle,
      isArchived: pack.isArchived,
      isSystemPack: pack.isSystemPack,
    };
  }

  public static toPublicDto(
    pack: CurriculumPack,
    options: CurriculumPackProjectionOptions,
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
      isSystemPack: pack.isSystemPack,
    };
  }
}
