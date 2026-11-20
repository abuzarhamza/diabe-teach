import type { GameSessionRepositoryPort } from "../../application/ports/game-session-repository.port.js";
import type { RoomCode } from "../../domain/game-session/room-code.js";
import type { SessionId } from "../../domain/game-session/session-id.js";
import { ConcurrentUpdateConflictError } from "../../domain/errors/domain-errors.js";
import { GameSession } from "../../domain/game-session/game-session.js";

/**
 * Keeps its own copy of each session and hands out fresh copies, so a loaded
 * session behaves like one read from MongoDB: changes stay private until
 * `update`, which applies the same version check as the Mongo repository.
 */
export class InMemoryGameSessionRepository
implements GameSessionRepositoryPort {
  readonly #sessionsById: Map<string, GameSession>;
  readonly #sessionIdsByRoomCode: Map<string, string>;

  public constructor(initialSessions: readonly GameSession[] = []) {
    this.#sessionsById = new Map();
    this.#sessionIdsByRoomCode = new Map();

    for (const session of initialSessions) {
      this.#store(session, session.version);
    }
  }

  public async create(session: GameSession): Promise<void> {
    this.#store(session, 0);
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    const stored = this.#sessionsById.get(sessionId.value);
    return stored
      ? InMemoryGameSessionRepository.#copy(stored, stored.version)
      : null;
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    const sessionId = this.#sessionIdsByRoomCode.get(roomCode.value);
    const stored = sessionId === undefined
      ? undefined
      : this.#sessionsById.get(sessionId);
    return stored
      ? InMemoryGameSessionRepository.#copy(stored, stored.version)
      : null;
  }

  public async update(session: GameSession): Promise<void> {
    const stored = this.#sessionsById.get(session.sessionId.value);
    if (!stored || stored.version !== session.version) {
      throw new ConcurrentUpdateConflictError(session.sessionId.value, session.version);
    }
    this.#store(session, session.version + 1);
  }

  #store(session: GameSession, version: number): void {
    this.#sessionsById.set(session.sessionId.value, InMemoryGameSessionRepository.#copy(session, version));
    this.#sessionIdsByRoomCode.set(session.roomCode.value, session.sessionId.value);
  }

  /** Copies through the domain's snapshot and restore, the same path the Mongo repository uses. */
  static #copy(session: GameSession, version: number): GameSession {
    return GameSession.fromSnapshot({
      ...session.toSnapshot(),
      version,
    });
  }
}
