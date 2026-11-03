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

  public constructor(currentPhase: string) {
    super(
      `Chain submissions are not allowed during phase '${currentPhase}'.`,
      { currentPhase },
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
