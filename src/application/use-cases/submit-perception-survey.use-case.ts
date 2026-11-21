import type { GameSession } from "../../domain/game-session/game-session.js";
import type { LikertRating } from "../../domain/game-session/game-session.types.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type {
  SubmitPerceptionSurveyCommand,
  SubmitPerceptionSurveyDependencies,
  SubmitPerceptionSurveyUseCasePort,
  SurveySubmissionReceipt,
} from "./submit-perception-survey.port.js";
import wordCount from "word-count";
import {
  ForbiddenRoleError,
  InvalidSurveyResponseError,
  PhaseClosedForSubmissionsError,
  SessionNotFoundError,
  SurveyCommentsTooLongError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";
import { SilentLogger } from "../services/silent-logger.js";

const MAX_COMMENT_WORDS = 1000;
const VALID_LIKERT_VALUES = new Set<LikertRating>([1, 2, 3, 4, 5]);

export class SubmitPerceptionSurveyUseCase implements SubmitPerceptionSurveyUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;

  public constructor(deps: SubmitPerceptionSurveyDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#packs = new SessionPackLoader(deps.packRepo);
  }

  public async execute(
    command: SubmitPerceptionSurveyCommand,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<SurveySubmissionReceipt> {
    // Validate participant role (only participants can submit, not instructors)
    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can submit perception surveys.");
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

    // Validate phase is feedback-survey
    this.#validatePhase(loaded);

    // Load curriculum pack for valid item IDs
    const pack = await this.#packs.load(loaded, logger);

    // Validate all response values are valid Likert ratings (1-5)
    this.#validateResponseValues(command.responses);

    // Validate comments length if provided
    if (command.comments !== undefined) {
      this.#validateCommentsLength(command.comments);
    }

    // Filter out response keys for item IDs not in pack's perceptionSurvey.items
    const validItemIds = new Set(
      pack.perceptionSurvey?.items.map(item => item.id) ?? [],
    );
    const filteredResponses = this.#filterValidResponses(
      command.responses,
      validItemIds,
    );

    // Convert to Map for domain method
    const responsesMap = new Map<string, LikertRating>(
      Object.entries(filteredResponses),
    );

    // Re-check the phase against fresh state on every attempt, then submit
    // (domain handles duplicate check with SurveyAlreadySubmittedError)
    const surveyResponse = await this.#sessionUpdates.run(
      sessionId,
      (session) => {
        this.#validatePhase(session);
        return session.submitSurvey(participantId, responsesMap, command.comments);
      },
      { logger },
    );
    logger.info({ sessionId: command.sessionId, participantId }, "survey submitted");

    // Return receipt
    return {
      participantId: surveyResponse.participantId,
      recordedItemCount: surveyResponse.responses.size,
      submittedAt: surveyResponse.submittedAt.toISOString(),
    };
  }

  #validatePhase(session: GameSession): void {
    if (session.currentPhase !== "feedback-survey") {
      throw new PhaseClosedForSubmissionsError(session.currentPhase);
    }
  }

  #validateResponseValues(
    responses: Readonly<Record<string, LikertRating>>,
  ): void {
    for (const [field, value] of Object.entries(responses)) {
      if (!VALID_LIKERT_VALUES.has(value as LikertRating)) {
        throw new InvalidSurveyResponseError(field, value);
      }
    }
  }

  #validateCommentsLength(comments: string): void {
    const count = wordCount(comments);
    if (count > MAX_COMMENT_WORDS) {
      throw new SurveyCommentsTooLongError(count, MAX_COMMENT_WORDS);
    }
  }

  #filterValidResponses(
    responses: Readonly<Record<string, LikertRating>>,
    validItemIds: Set<string>,
  ): Record<string, LikertRating> {
    const filtered: Record<string, LikertRating> = {};

    for (const [itemId, value] of Object.entries(responses)) {
      if (validItemIds.has(itemId)) {
        filtered[itemId] = value;
      }
    }

    return filtered;
  }
}
