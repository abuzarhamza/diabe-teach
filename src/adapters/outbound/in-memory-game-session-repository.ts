import type { GameSessionRepositoryPort } from "../../application/ports/game-session-repository.port.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type { RoomCode } from "../../domain/game-session/room-code.js";
import type { SessionId } from "../../domain/game-session/session-id.js";

export class InMemoryGameSessionRepository
implements GameSessionRepositoryPort {
  readonly #sessionsById: Map<string, GameSession>;
  readonly #sessionsByRoomCode: Map<string, GameSession>;

  public constructor(initialSessions: readonly GameSession[] = []) {
    this.#sessionsById = new Map();
    this.#sessionsByRoomCode = new Map();

    for (const session of initialSessions) {
      this.#sessionsById.set(session.sessionId.value, session);
      this.#sessionsByRoomCode.set(session.roomCode.value, session);
    }
  }

  public async create(session: GameSession): Promise<void> {
    this.#sessionsById.set(session.sessionId.value, session);
    this.#sessionsByRoomCode.set(session.roomCode.value, session);
  }

  public async findById(sessionId: SessionId): Promise<GameSession | null> {
    return this.#sessionsById.get(sessionId.value) ?? null;
  }

  public async findByRoomCode(roomCode: RoomCode): Promise<GameSession | null> {
    return this.#sessionsByRoomCode.get(roomCode.value) ?? null;
  }

  public async update(session: GameSession): Promise<void> {
    this.#sessionsById.set(session.sessionId.value, session);
    this.#sessionsByRoomCode.set(session.roomCode.value, session);
  }
}
