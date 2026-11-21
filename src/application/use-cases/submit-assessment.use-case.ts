import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { AssessmentQuestion } from "../../domain/curriculum-pack/curriculum-pack.types.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type {
  AssessmentAttempt,
  McqAnswerChoice,
} from "../../domain/game-session/game-session.types.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type {
  PosttestSubmissionResult,
  PretestSubmissionReceipt,
  QuestionReviewItem,
  SubmitAssessmentCommand,
  SubmitAssessmentDependencies,
  SubmitAssessmentResult,
  SubmitAssessmentUseCasePort,
} from "../ports/submit-assessment.port.js";
import {
  AssessmentIncompleteError,
  ForbiddenRoleError,
  PhaseClosedForSubmissionsError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { LearnerAnalyticsService } from "../services/learner-analytics-service.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";
import { SilentLogger } from "../services/silent-logger.js";

export class SubmitAssessmentUseCase implements SubmitAssessmentUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;
  readonly #analytics = new LearnerAnalyticsService();

  public constructor(deps: SubmitAssessmentDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#packs = new SessionPackLoader(deps.packRepo);
  }

  public async execute(
    command: SubmitAssessmentCommand,
    logger: LoggerPort = new SilentLogger(),
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

    // A learner who left is refused before any phase check (the domain
    // enforces it again on submit).
    loaded.assertParticipantHasNotLeft(participantId);

    // Validate phase matches stage (and pretest prerequisite for posttest)
    this.#validatePhaseForStage(loaded, command.stage, participantId);

    // Load curriculum pack for question validation
    const pack = await this.#packs.load(loaded, logger);

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
      { logger },
    );
    logger.info(
      { sessionId: command.sessionId, participantId, stage: command.stage },
      "assessment submitted",
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
    const pretestAttempt = session.getAssessment(
      posttestAttempt.participantId,
      "pretest",
    );

    // Build answer key review with both pretest and posttest choices
    const answerKeyReview = this.#buildAnswerKeyReview(
      questions,
      pretestAttempt?.answers ?? null,
      posttestAttempt.answers,
    );

    // The same report the analytics route serves, now the posttest is stored.
    const report = this.#analytics.buildReport(
      session,
      pack,
      posttestAttempt.participantId,
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
}
