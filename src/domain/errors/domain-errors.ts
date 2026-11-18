import type { PhaseClosedReason } from "./domain-errors.types.js";

export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class PackNotFoundError extends DomainError {
  public readonly code = "PACK_NOT_FOUND" as const;

  public constructor(packId: string) {
    super(`Curriculum Pack '${packId}' was not found.`, { packId });
  }
}

export class UnauthorizedTokenError extends DomainError {
  public readonly code = "UNAUTHORIZED_TOKEN" as const;

  public constructor(message = "Missing, malformed, or invalid bearer token.") {
    super(message);
  }
}

export class InvalidPhaseTransitionError extends DomainError {
  public readonly code = "INVALID_PHASE_TRANSITION" as const;

  public constructor(fromPhase: string, toPhase: string) {
    super(
      `Cannot transition from '${fromPhase}' to '${toPhase}'.`,
      { fromPhase, toPhase },
    );
  }
}

export class SessionNotFoundError extends DomainError {
  public readonly code = "SESSION_NOT_FOUND" as const;

  public constructor(sessionId: string) {
    super(`Game Session '${sessionId}' was not found.`, { sessionId });
  }
}

export class RoomCodeNotFoundError extends DomainError {
  public readonly code = "ROOM_CODE_NOT_FOUND" as const;

  public constructor(roomCode: string) {
    super(`No active session found with room code '${roomCode}'.`, { roomCode });
  }
}

export class ForbiddenRoleError extends DomainError {
  public readonly code = "FORBIDDEN_ROLE" as const;

  public constructor(message = "You do not have permission to access this resource.") {
    super(message);
  }
}

export class PhaseClosedForSubmissionsError extends DomainError {
  public readonly code = "PHASE_CLOSED_FOR_SUBMISSIONS" as const;

  // Without `reason`, the current phase does not accept submissions at all.
  // `phaseEndsAt` means the phase's deadline (plus the grace period) passed;
  // `requestedRoundNumber` means the chain was sent to a round that is not
  // the active one.
  public constructor(currentPhase: string, reason?: PhaseClosedReason) {
    super(
      PhaseClosedForSubmissionsError.#message(currentPhase, reason),
      PhaseClosedForSubmissionsError.#details(currentPhase, reason),
    );
  }

  static #message(currentPhase: string, reason?: PhaseClosedReason): string {
    if (reason === undefined) {
      return `Chain submissions are not allowed during phase '${currentPhase}'.`;
    }
    if ("phaseEndsAt" in reason) {
      return `Chain submissions for phase '${currentPhase}' are closed: the phase ended at ${reason.phaseEndsAt.toISOString()} (plus a ${reason.gracePeriodSec}s grace period).`;
    }
    return `Chain submissions for round ${reason.requestedRoundNumber} are closed: the active round is ${reason.activeRoundNumber ?? "none"} (phase '${currentPhase}').`;
  }

  static #details(currentPhase: string, reason?: PhaseClosedReason): Record<string, unknown> {
    if (reason === undefined) {
      return { currentPhase };
    }
    if ("phaseEndsAt" in reason) {
      return {
        currentPhase,
        phaseEndsAt: reason.phaseEndsAt.toISOString(),
        gracePeriodSec: reason.gracePeriodSec,
      };
    }
    return {
      currentPhase,
      requestedRoundNumber: reason.requestedRoundNumber,
      activeRoundNumber: reason.activeRoundNumber,
    };
  }
}

export class ChainAlreadySubmittedError extends DomainError {
  public readonly code = "CHAIN_ALREADY_SUBMITTED" as const;

  public constructor(participantId: string, roundNumber: number, existingChainId: string) {
    super(
      `Participant '${participantId}' already submitted this Concept Chain in round ${roundNumber}.`,
      { participantId, roundNumber, existingChainId },
    );
  }
}

export class ChainTopologyInvalidError extends DomainError {
  public readonly code = "CHAIN_TOPOLOGY_INVALID" as const;

  public constructor(reason: string) {
    super(`Invalid chain topology: ${reason}.`, { reason });
  }
}

export class ChainNotFoundError extends DomainError {
  public readonly code = "CHAIN_NOT_FOUND" as const;

  public constructor(chainId: string) {
    super(`Concept Chain '${chainId}' was not found.`, { chainId });
  }
}

export class AdjudicationLockedError extends DomainError {
  public readonly code = "ADJUDICATION_LOCKED_BY_INSTRUCTOR" as const;

  public constructor(chainId: string) {
    super(
      `Chain '${chainId}' has been locked by instructor final ruling.`,
      { chainId },
    );
  }
}

export class PackAlreadyExistsError extends DomainError {
  public readonly code = "PACK_ALREADY_EXISTS" as const;

  public constructor(packId: string, version: string) {
    super(
      `Curriculum Pack '${packId}' version '${version}' already exists.`,
      { packId, version },
    );
  }
}

export class PackIsSystemPackError extends DomainError {
  public readonly code = "PACK_IS_SYSTEM_PACK" as const;

  public constructor(packId: string) {
    super(
      `System pack '${packId}' cannot be archived or modified.`,
      { packId },
    );
  }
}

export class PackAlreadyArchivedError extends DomainError {
  public readonly code = "PACK_ALREADY_ARCHIVED" as const;

  public constructor(packId: string) {
    super(
      `Curriculum Pack '${packId}' is already archived.`,
      { packId },
    );
  }
}

export class PackNotArchivedError extends DomainError {
  public readonly code = "PACK_NOT_ARCHIVED" as const;

  public constructor(packId: string) {
    super(
      `Curriculum Pack '${packId}' is not archived.`,
      { packId },
    );
  }
}

export class AssessmentAlreadySubmittedError extends DomainError {
  public readonly code = "ASSESSMENT_ALREADY_SUBMITTED" as const;

  public constructor(participantId: string, stage: string) {
    super(
      `Participant '${participantId}' has already submitted the ${stage} assessment.`,
      { participantId, stage },
    );
  }
}

export class AssessmentIncompleteError extends DomainError {
  public readonly code = "ASSESSMENT_INCOMPLETE" as const;

  public constructor(answeredCount: number, requiredCount: number) {
    super(
      `Assessment is incomplete: ${answeredCount} of ${requiredCount} questions answered.`,
      { answeredCount, requiredCount },
    );
  }
}

export class SurveyAlreadySubmittedError extends DomainError {
  public readonly code = "SURVEY_ALREADY_SUBMITTED" as const;

  public constructor(participantId: string, sessionId: string) {
    super(
      `Participant '${participantId}' has already submitted the perception survey for session '${sessionId}'.`,
      { participantId, sessionId },
    );
  }
}

export class SurveyCommentsTooLongError extends DomainError {
  public readonly code = "SURVEY_COMMENTS_TOO_LONG" as const;

  public constructor(wordCount: number, maxWords: number) {
    super(
      `Survey comments exceed maximum length: ${wordCount} words provided, maximum is ${maxWords}.`,
      { wordCount, maxWords },
    );
  }
}

export class InvalidSurveyResponseError extends DomainError {
  public readonly code = "INVALID_SURVEY_RESPONSE" as const;

  public constructor(field: string, invalidValue: unknown) {
    super(
      `Invalid survey response for '${field}': value '${invalidValue}' is not a valid Likert scale option.`,
      { field, invalidValue },
    );
  }
}

export class InvalidTimerConfigError extends DomainError {
  public readonly code = "INVALID_REQUEST_BODY" as const;

  public constructor(field: string, value: unknown) {
    super(
      `Invalid timer config '${field}': timerConfig must be an object of known phase durations, each a whole number of seconds from 1 to 86400, or null for an instructor-driven phase.`,
      { field, value },
    );
  }
}

/**
 * A Game Session save found the stored session at a different version than
 * the one that was loaded (or no stored session at all), so another write got
 * there first. Nothing was overwritten; the request is safe to retry.
 */
export class ConcurrentUpdateConflictError extends DomainError {
  public readonly code = "CONCURRENT_UPDATE_CONFLICT" as const;

  public constructor(sessionId: string, expectedVersion: number) {
    super(
      `Game Session '${sessionId}' was changed by another request. Reload it and try again.`,
      { sessionId, expectedVersion },
    );
  }
}
