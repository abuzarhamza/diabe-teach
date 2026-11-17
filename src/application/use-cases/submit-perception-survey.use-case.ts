import type { LikertRating } from "../../domain/game-session/game-session.types.js";
import type { CurriculumPackRepositoryPort } from "../ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  SubmitPerceptionSurveyCommand,
  SubmitPerceptionSurveyDependencies,
  SubmitPerceptionSurveyUseCasePort,
  SurveySubmissionReceipt,
} from "./submit-perception-survey.port.js";
import wordCount from "word-count";
import { PackId } from "../../domain/curriculum-pack/pack-id.js";
import {
  ForbiddenRoleError,
  InvalidSurveyResponseError,
  PackNotFoundError,
  PhaseClosedForSubmissionsError,
  SessionNotFoundError,
  SurveyCommentsTooLongError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";

const MAX_COMMENT_WORDS = 1000;
const VALID_LIKERT_VALUES = new Set<LikertRating>([1, 2, 3, 4, 5]);

export class SubmitPerceptionSurveyUseCase implements SubmitPerceptionSurveyUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #packRepo: CurriculumPackRepositoryPort;

  public constructor(deps: SubmitPerceptionSurveyDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#packRepo = deps.packRepo;
  }

  public async execute(
    command: SubmitPerceptionSurveyCommand,
  ): Promise<SurveySubmissionReceipt> {
    // Validate participant role (only participants can submit, not instructors)
    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can submit perception surveys.");
    }

    const participantId = command.verifiedCapability.participantId;
    if (!participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    // Load session
    const sessionId = SessionId.from(command.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

    // Validate phase is feedback-survey
    if (session.currentPhase !== "feedback-survey") {
      throw new PhaseClosedForSubmissionsError(session.currentPhase);
    }

    // Load curriculum pack for valid item IDs
    const packId = PackId.create(session.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(session.packId);
    }

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

    // Submit survey (domain handles duplicate check with SurveyAlreadySubmittedError)
    const surveyResponse = session.submitSurvey(
      participantId,
      responsesMap,
      command.comments,
    );

    // Persist the updated session
    await this.#sessionRepo.update(session);

    // Return receipt
    return {
      participantId: surveyResponse.participantId,
      recordedItemCount: surveyResponse.responses.size,
      submittedAt: surveyResponse.submittedAt.toISOString(),
    };
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
