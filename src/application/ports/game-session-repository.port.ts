import type { GameSession } from "../../domain/game-session/game-session.js";
import type { RoomCode } from "../../domain/game-session/room-code.js";
import type { SessionId } from "../../domain/game-session/session-id.js";

export interface GameSessionRepositoryPort {
  create: (session: GameSession) => Promise<void>;
  findById: (sessionId: SessionId) => Promise<GameSession | null>;
  findByRoomCode: (roomCode: RoomCode) => Promise<GameSession | null>;
  update: (session: GameSession) => Promise<void>;
}
