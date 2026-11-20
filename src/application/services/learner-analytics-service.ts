import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { AssessmentQuestion } from "../../domain/curriculum-pack/curriculum-pack.types.js";
import type { ConceptChain } from "../../domain/game-session/concept-chain.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type {
  AssessmentStage,
  McqAnswerChoice,
} from "../../domain/game-session/game-session.types.js";
import type {
  AssessmentStageSummary,
  LearnerMetacognitiveReport,
} from "../dtos/session-analytics.dto.js";

/**
 * Computes a learner's metacognitive report from a stored Game Session and
 * the Curriculum Pack it plays (its pinned Pack Version). Missing inputs,
 * such as a stage not taken yet, give `null` rather than errors.
 */
export class LearnerAnalyticsService {
  public buildReport(
    session: GameSession,
    pack: CurriculumPack,
    participantId: string,
  ): LearnerMetacognitiveReport {
    const questions = pack.assessmentInstrument?.questions ?? [];
    const pretest = this.#stageSummary(session, questions, participantId, "pretest");
    const posttest = this.#stageSummary(session, questions, participantId, "posttest");
    const chains = session.chains.filter(c => c.participantId === participantId);

    return {
      participantId,
      pretest,
      posttest,
      knowledgeGainDelta: pretest && posttest
        ? posttest.correctPercentage - pretest.correctPercentage
        : null,
      guessingReductionDelta: pretest && posttest
        ? pretest.wrongGuessPercentage - posttest.wrongGuessPercentage
        : null,
      chainDiversityIndex: this.#chainDiversityIndex(pack, chains),
      neglectedKeywordIds: this.#neglectedKeywordIds(session, chains),
    };
  }

  /** A stage's summary, or `null` when the learner has not taken it. */
  #stageSummary(
    session: GameSession,
    questions: readonly AssessmentQuestion[],
    participantId: string,
    stage: AssessmentStage,
  ): AssessmentStageSummary | null {
    const attempt = session.getAssessment(participantId, stage);
    return attempt
      ? LearnerAnalyticsService.summarizeStage(stage, questions, attempt.answers)
      : null;
  }

  /**
   * Counts correct answers, wrong guesses and "I don't know" over the pack's
   * questions; an unanswered question counts as "I don't know".
   */
  public static summarizeStage(
    stage: AssessmentStage,
    questions: readonly AssessmentQuestion[],
    answers: ReadonlyMap<string, McqAnswerChoice>,
  ): AssessmentStageSummary {
    const totalQuestions = questions.length;
    let correctCount = 0;
    let wrongGuessCount = 0;
    let iDontKnowCount = 0;

    for (const question of questions) {
      const answer = answers.get(question.id);
      if (answer === "I_DONT_KNOW" || answer === undefined) {
        iDontKnowCount++;
      }
      else if (answer === question.correctIndex) {
        correctCount++;
      }
      else {
        wrongGuessCount++;
      }
    }

    const percentage = (count: number) => totalQuestions === 0
      ? 0
      : (count / totalQuestions) * 100;
    // iDontKnow / (iDontKnow + wrongGuess), or 1.0 when both are 0.
    const calibrationDenominator = iDontKnowCount + wrongGuessCount;

    return {
      stage,
      totalQuestions,
      correctCount,
      wrongGuessCount,
      iDontKnowCount,
      correctPercentage: percentage(correctCount),
      wrongGuessPercentage: percentage(wrongGuessCount),
      iDontKnowPercentage: percentage(iDontKnowCount),
      uncertaintyCalibrationRatio: calibrationDenominator === 0
        ? 1.0
        : iDontKnowCount / calibrationDenominator,
    };
  }

  /**
   * Distinct Semantic Domains crossed by the learner's approved chains ÷ the
   * pack's Semantic Domain count (0 when the pack has none).
   */
  #chainDiversityIndex(
    pack: CurriculumPack,
    chains: readonly ConceptChain[],
  ): number {
    const totalDomains = pack.domains.length;
    if (totalDomains === 0) {
      return 0;
    }

    const crossedDomainIds = new Set<string>();
    for (const chain of chains) {
      if (chain.status !== "approved" && !chain.verdict?.isApproved) {
        continue;
      }
      for (const keywordId of chain.keywordIds) {
        const card = pack.getCardById(keywordId);
        if (card) {
          crossedDomainIds.add(card.domainId);
        }
      }
    }

    return crossedDomainIds.size / totalDomains;
  }

  /**
   * Keyword Cards on the dealt round boards (in round, row, column order,
   * each once) that none of the learner's chains used, whatever their
   * verdict. Empty when no board was dealt.
   */
  #neglectedKeywordIds(
    session: GameSession,
    chains: readonly ConceptChain[],
  ): string[] {
    const usedKeywordIds = new Set(chains.flatMap(c => c.keywordIds));
    const neglected = new Set<string>();

    for (const board of session.roundBoards) {
      for (const row of board.cells) {
        for (const card of row) {
          if (!usedKeywordIds.has(card.id)) {
            neglected.add(card.id);
          }
        }
      }
    }

    return [...neglected];
  }
}
