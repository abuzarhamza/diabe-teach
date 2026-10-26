import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type {
  CurriculumPackProjectionOptions,
  PublicAssessmentQuestionDto,
  PublicCurriculumPackDto,
} from "./curriculum-pack.dto.js";

export class CurriculumPackProjector {
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
    };
  }
}
