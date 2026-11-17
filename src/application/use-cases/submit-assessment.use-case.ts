import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { AssessmentQuestion } from "../../domain/curriculum-pack/curriculum-pack.types.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type {
  AssessmentAttempt,
  McqAnswerChoice,
} from "../../domain/game-session/game-session.types.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  AssessmentStageSummary,
  LearnerMetacognitiveReport,
  PosttestSubmissionResult,
  PretestSubmissionReceipt,
  QuestionReviewItem,
  SubmitAssessmentCommand,
  SubmitAssessmentDependencies,
  SubmitAssessmentResult,
  SubmitAssessmentUseCasePort,
} from "../ports/submit-assessment.port.js";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  AssessmentIncompleteError,
  ForbiddenRoleError,
  PackNotFoundError,
  PhaseClosedForSubmissionsError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

export class SubmitAssessmentUseCase implements SubmitAssessmentUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: SubmitAssessmentDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#packRepo = deps.packRepo;
  }

  public async execute(
    command: SubmitAssessmentCommand,
  ): Promise<SubmitAssessmentResult> {
    // Validate participant role
    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can submit assessments.");
    }

    const participantId = command.verifiedCapability.participantId;
    if (!participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    // Load the session once up front, to find and load its curriculum pack.
    // The command below runs synchronously, so the pack must be ready first.
    const sessionId = SessionId.from(command.sessionId);
    const loaded = await this.#sessionRepo.findById(sessionId);

    if (!loaded) {
      throw new SessionNotFoundError(command.sessionId);
    }

    // Validate phase matches stage (and pretest prerequisite for posttest)
    this.#validatePhaseForStage(loaded, command.stage, participantId);

    // Load curriculum pack for question validation
    const packId = PackId.create(loaded.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(loaded.packId);
    }

    // Validate all questions have answers
    const questions = pack.assessmentInstrument?.questions ?? [];
    this.#validateAnswerCompleteness(questions, command.answers);

    // Convert answers to Map for domain method
    const answersMap = new Map<string, McqAnswerChoice>(
      Object.entries(command.answers),
    );

    // Re-check the phase against fresh state on every attempt, then submit
    // (domain handles duplicate check)
    const { session, attempt } = await this.#sessionUpdates.run(
      sessionId,
      (session) => {
        this.#validatePhaseForStage(session, command.stage, participantId);
        return {
          session,
          attempt: session.submitAssessment(participantId, command.stage, answersMap),
        };
      },
    );

    // Return stage-appropriate result
    if (command.stage === "pretest") {
      return this.#buildPretestReceipt(attempt);
    }

    return this.#buildPosttestResult(session, pack, attempt);
  }

  #validatePhaseForStage(
    session: GameSession,
    stage: "pretest" | "posttest",
    participantId: string,
  ): void {
    const currentPhase = session.currentPhase;

    if (stage === "pretest" && currentPhase !== "pretest") {
      throw new PhaseClosedForSubmissionsError(currentPhase);
    }

    if (stage === "posttest") {
      if (currentPhase !== "posttest") {
        throw new PhaseClosedForSubmissionsError(currentPhase);
      }
      // Participant must have completed pretest before submitting posttest
      const pretestAttempt = session.getAssessment(participantId, "pretest");
      if (!pretestAttempt) {
        throw new PhaseClosedForSubmissionsError(currentPhase);
      }
    }
  }

  #validateAnswerCompleteness(
    questions: readonly AssessmentQuestion[],
    answers: Readonly<Record<string, McqAnswerChoice>>,
  ): void {
    const requiredQuestionIds = new Set(questions.map(q => q.id));
    const answeredQuestionIds = new Set(Object.keys(answers));

    // Check if all required questions are answered
    const missingCount = [...requiredQuestionIds].filter(
      id => !answeredQuestionIds.has(id),
    ).length;

    if (missingCount > 0) {
      throw new AssessmentIncompleteError(
        answeredQuestionIds.size,
        requiredQuestionIds.size,
      );
    }
  }

  #buildPretestReceipt(attempt: AssessmentAttempt): PretestSubmissionReceipt {
    return {
      stage: "pretest",
      participantId: attempt.participantId,
      recordedCount: attempt.answers.size,
      submittedAt: attempt.submittedAt.toISOString(),
    };
  }

  #buildPosttestResult(
    session: GameSession,
    pack: CurriculumPack,
    posttestAttempt: AssessmentAttempt,
  ): PosttestSubmissionResult {
    const questions = pack.assessmentInstrument?.questions ?? [];
    const pretestAttempt = session.assessments.get("pretest");

    // Build answer key review with both pretest and posttest choices
    const answerKeyReview = this.#buildAnswerKeyReview(
      questions,
      pretestAttempt?.answers ?? null,
      posttestAttempt.answers,
    );

    // Build metacognitive report
    const report = this.#buildMetacognitiveReport(
      session,
      pack,
      pretestAttempt,
      posttestAttempt,
    );

    return {
      stage: "posttest",
      participantId: posttestAttempt.participantId,
      submittedAt: posttestAttempt.submittedAt.toISOString(),
      report,
      answerKeyReview,
    };
  }

  #buildAnswerKeyReview(
    questions: readonly AssessmentQuestion[],
    pretestAnswers: ReadonlyMap<string, McqAnswerChoice> | null,
    posttestAnswers: ReadonlyMap<string, McqAnswerChoice>,
  ): QuestionReviewItem[] {
    return questions.map((question) => {
      const pretestChoice = pretestAnswers?.get(question.id) ?? null;
      const posttestChoice = posttestAnswers.get(question.id) ?? "I_DONT_KNOW";

      return {
        questionId: question.id,
        stem: question.stem,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation || null,
        pretestChoice,
        posttestChoice,
      };
    });
  }

  #buildMetacognitiveReport(
    session: GameSession,
    pack: CurriculumPack,
    pretestAttempt: AssessmentAttempt | undefined,
    posttestAttempt: AssessmentAttempt,
  ): LearnerMetacognitiveReport {
    const questions = pack.assessmentInstrument?.questions ?? [];
    const participantId = posttestAttempt.participantId;

    // Calculate stage summaries
    const pretestSummary = pretestAttempt
      ? this.#calculateStageSummary("pretest", questions, pretestAttempt.answers)
      : null;

    const posttestSummary = this.#calculateStageSummary(
      "posttest",
      questions,
      posttestAttempt.answers,
    );

    // Calculate deltas (null if no pretest)
    const knowledgeGainDelta = pretestSummary
      ? posttestSummary.correctPercentage - pretestSummary.correctPercentage
      : null;

    const guessingReductionDelta = pretestSummary
      ? pretestSummary.wrongGuessPercentage - posttestSummary.wrongGuessPercentage
      : null;

    // Calculate chain diversity index
    const chainDiversityIndex = this.#calculateChainDiversityIndex(
      session,
      pack,
      participantId,
    );

    // Find neglected keywords
    const neglectedKeywordIds = this.#findNeglectedKeywords(
      session,
      pack,
      participantId,
    );

    return {
      participantId,
      pretest: pretestSummary,
      posttest: posttestSummary,
      knowledgeGainDelta,
      guessingReductionDelta,
      chainDiversityIndex,
      neglectedKeywordIds,
    };
  }

  #calculateStageSummary(
    stage: "pretest" | "posttest",
    questions: readonly AssessmentQuestion[],
    answers: ReadonlyMap<string, McqAnswerChoice>,
  ): AssessmentStageSummary {
    const totalQuestions = questions.length;

    if (totalQuestions === 0) {
      return {
        stage,
        totalQuestions: 0,
        correctCount: 0,
        wrongGuessCount: 0,
        iDontKnowCount: 0,
        correctPercentage: 0,
        wrongGuessPercentage: 0,
        iDontKnowPercentage: 0,
        uncertaintyCalibrationRatio: 1.0,
      };
    }

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

    // Calculate uncertainty calibration ratio for this stage
    // = I_DONT_KNOW / (I_DONT_KNOW + wrongGuess), or 1.0 if both are 0
    const calibrationDenominator = iDontKnowCount + wrongGuessCount;
    const uncertaintyCalibrationRatio = calibrationDenominator === 0
      ? 1.0
      : iDontKnowCount / calibrationDenominator;

    return {
      stage,
      totalQuestions,
      correctCount,
      wrongGuessCount,
      iDontKnowCount,
      correctPercentage: (correctCount / totalQuestions) * 100,
      wrongGuessPercentage: (wrongGuessCount / totalQuestions) * 100,
      iDontKnowPercentage: (iDontKnowCount / totalQuestions) * 100,
      uncertaintyCalibrationRatio,
    };
  }

  /**
   * Calculate the chain diversity index as the ratio of unique semantic domains
   * used across all chains by this participant to the total domains in the pack.
   * Returns a value between 0 and 1.
   */
  #calculateChainDiversityIndex(
    session: GameSession,
    pack: CurriculumPack,
    participantId: string,
  ): number {
    const participantChains = session.chains.filter(
      c => c.participantId === participantId,
    );

    if (participantChains.length === 0) {
      return 0;
    }

    // Get unique domains from cards used in chains
    const usedDomainIds = new Set<string>();

    for (const chain of participantChains) {
      for (const keywordId of chain.keywordIds) {
        const card = pack.getCardById(keywordId);
        if (card) {
          usedDomainIds.add(card.domainId);
        }
      }
    }

    const totalDomains = pack.domains.length;

    if (totalDomains === 0) {
      return 0;
    }

    return usedDomainIds.size / totalDomains;
  }

  /**
   * Find keywords from the pack that were never used in any chain by this participant.
   * These represent potential blind spots.
   */
  #findNeglectedKeywords(
    session: GameSession,
    pack: CurriculumPack,
    participantId: string,
  ): string[] {
    const participantChains = session.chains.filter(
      c => c.participantId === participantId,
    );

    // Collect all keyword IDs used by this participant
    const usedKeywordIds = new Set<string>();
    for (const chain of participantChains) {
      for (const keywordId of chain.keywordIds) {
        usedKeywordIds.add(keywordId);
      }
    }

    // Find keywords that were never used
    const neglected: string[] = [];
    for (const card of pack.cards) {
      if (!usedKeywordIds.has(card.id)) {
        neglected.push(card.id);
      }
    }

    return neglected;
  }
}
